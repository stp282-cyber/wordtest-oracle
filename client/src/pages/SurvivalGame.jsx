import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, deleteDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Heart, Zap, Skull, Trophy, LogOut, Shield, Ghost, Wind, Users } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function SurvivalGame() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const userId = localStorage.getItem('userId');

    // Game State
    const [room, setRoom] = useState(null);
    const [words, setWords] = useState([]);
    const [fallingWords, setFallingWords] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [gameState, setGameState] = useState('loading'); // loading, waiting, playing, dead, finished
    const [myStatus, setMyStatus] = useState({ hp: 100, gauge: 0, score: 0, alive: true });
    const [activeEffect, setActiveEffect] = useState(null); // fog, speed, etc.
    const [winner, setWinner] = useState(null);

    // Refs
    const lastSpawnTimeRef = useRef(0);
    const requestRef = useRef();
    const gameAreaRef = useRef(null);
    const inputRef = useRef(null);
    const speedMultiplierRef = useRef(1);

    // Constants
    const SPAWN_RATE = 3000;
    const BASE_SPEED = 0.015;
    const GAUGE_PER_WORD = 20;

    // 2. Handle Incoming Effects
    const handleIncomingEffect = useCallback((effectType) => {
        setActiveEffect(effectType);

        // Visual Feedback
        const colors = { fog: '#6B7280', speed: '#EF4444', flash: '#FCD34D' };
        confetti({
            particleCount: 50,
            spread: 360,
            origin: { x: 0.5, y: 0.5 },
            colors: [colors[effectType] || '#ffffff']
        });

        // Apply Logic
        if (effectType === 'speed') {
            speedMultiplierRef.current = 2.5;
        }

        // Clear effect after duration
        setTimeout(() => {
            setActiveEffect(null);
            speedMultiplierRef.current = 1;
        }, 5000); // 5 seconds duration
    }, []);

    // 1. Room Sync & Player Management
    useEffect(() => {
        const roomRef = doc(db, 'battles', roomId);
        const unsubscribe = onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRoom(data);

                // Sync my status from DB if needed, or just rely on local state pushing to DB?
                // Better to rely on local state for game loop, but listen for external effects.
                if (data.players && data.players[userId]) {
                    const me = data.players[userId];

                    // Check for incoming attacks/effects
                    if (me.effect && me.effect !== activeEffect) {
                        handleIncomingEffect(me.effect);
                        // Clear effect in DB immediately so it doesn't re-trigger
                        updateDoc(roomRef, { [`players.${userId}.effect`]: null });
                    }
                }

                // Check Game Over / Winner
                if (data.status === 'finished') {
                    if (gameState !== 'finished') {
                        setGameState('finished');
                        if (data.winnerId) setWinner(data.players[data.winnerId]);
                    }
                }
                // Handle Game Start / Join
                else if (data.status === 'playing') {
                    if (gameState === 'loading' || gameState === 'waiting') {
                        setGameState('playing');
                        if (data.gameWords && words.length === 0) {
                            setWords(data.gameWords);
                        }
                    }
                }
                // Handle Waiting Room
                else if (data.status === 'waiting') {
                    if (gameState === 'loading') {
                        setGameState('waiting');
                    }
                }
            } else {
                alert('방이 삭제되었습니다.');
                navigate('/student/survival');
            }
        });

        return () => unsubscribe();
    }, [roomId, navigate, userId, gameState, activeEffect, words.length, handleIncomingEffect]);

    // 5. Helpers
    const checkWinner = useCallback(async () => {
        // Only host checks winner to avoid race conditions
        if (room.hostId !== userId) return;

        // Need fresh data
        const roomSnap = await getDoc(doc(db, 'battles', roomId));
        const players = Object.values(roomSnap.data().players);
        const alivePlayers = players.filter(p => p.alive);

        if (alivePlayers.length === 1 && players.length > 1) {
            await updateDoc(doc(db, 'battles', roomId), {
                status: 'finished',
                winnerId: alivePlayers[0].id
            });
        } else if (alivePlayers.length === 0) {
            // Everyone died?
            await updateDoc(doc(db, 'battles', roomId), {
                status: 'finished'
            });
        }
    }, [room, roomId, userId]);

    const handleDeath = useCallback(async () => {
        setGameState('dead');
        setMyStatus(prev => ({ ...prev, hp: 0, alive: false }));
        await updateDoc(doc(db, 'battles', roomId), {
            [`players.${userId}.alive`]: false,
            [`players.${userId}.hp`]: 0
        });
        checkWinner();
    }, [roomId, userId, checkWinner]);

    const spawnWord = useCallback(() => {
        if (words.length === 0) return;
        const randomWord = words[Math.floor(Math.random() * words.length)];
        setFallingWords(prev => [
            ...prev,
            {
                id: Date.now() + Math.random(),
                word: randomWord.english,
                meaning: randomWord.korean,
                x: Math.random() * 70 + 15,
                y: 10,
                speed: BASE_SPEED + Math.random() * 0.02
            }
        ]);
    }, [words, BASE_SPEED]);

    const updateGameRef = useRef();

    // 3. Game Loop
    const updateGame = useCallback((time) => {
        if (gameState !== 'playing') return;

        setFallingWords(prev => {
            const nextWords = [];
            let damageTaken = 0;

            prev.forEach(fw => {
                if (fw.isDissolving) {
                    if (Date.now() - fw.dissolveTime < 500) nextWords.push(fw);
                    return;
                }

                const moveAmount = (fw.speed * speedMultiplierRef.current);
                const nextY = fw.y + moveAmount;

                // End game area earlier (75%) to avoid overlap with input box
                if (nextY > 75) {
                    damageTaken += 10;
                    nextWords.push({ ...fw, y: 75, isDissolving: true, dissolveTime: Date.now() });
                } else {
                    nextWords.push({ ...fw, y: nextY });
                }
            });

            if (damageTaken > 0) {
                setMyStatus(prev => {
                    const newHp = Math.max(0, prev.hp - damageTaken);
                    if (newHp <= 0) handleDeath();
                    return { ...prev, hp: newHp };
                });

                // Shake effect
                if (gameAreaRef.current) {
                    gameAreaRef.current.classList.add('animate-shake');
                    setTimeout(() => gameAreaRef.current?.classList.remove('animate-shake'), 500);
                }
            }

            return nextWords;
        });

        // Spawn
        if (time - lastSpawnTimeRef.current > SPAWN_RATE / speedMultiplierRef.current) {
            spawnWord();
            lastSpawnTimeRef.current = time;
        }

        requestRef.current = requestAnimationFrame((t) => updateGameRef.current(t));
    }, [gameState, handleDeath, spawnWord, SPAWN_RATE]);

    useEffect(() => {
        updateGameRef.current = updateGame;
    }, [updateGame]);

    // Start game loop when playing
    useEffect(() => {
        if (gameState === 'playing' && words.length > 0) {
            requestRef.current = requestAnimationFrame((t) => updateGameRef.current(t));
            inputRef.current?.focus();
        }
        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [gameState, words.length]);

    const handleInput = (e) => {
        const value = e.target.value;
        setUserInput(value);

        const trimmed = value.trim().toLowerCase();
        const matchIndex = fallingWords.findIndex(fw => !fw.isDissolving && fw.word.toLowerCase() === trimmed);

        if (matchIndex !== -1) {
            // Correct
            const word = fallingWords[matchIndex];
            setFallingWords(prev => prev.filter((_, i) => i !== matchIndex));
            setUserInput('');

            setMyStatus(prev => ({
                ...prev,
                score: prev.score + 100,
                gauge: Math.min(100, prev.gauge + GAUGE_PER_WORD)
            }));

            // Explosion effect
            confetti({
                particleCount: 20,
                spread: 40,
                origin: { x: word.x / 100, y: word.y / 100 },
                colors: ['#34D399', '#60A5FA']
            });
        }
    };

    const handleStartGame = async () => {
        if (room.playerCount < 2) {
            alert("최소 2명이 필요합니다.");
            return;
        }

        // Fetch words and start
        try {
            // Optimized Fetching Logic
            let targetBook = room.selectedBook;
            let totalWords = 0;

            // 1. Determine Book and Total Words
            if (!targetBook) {
                // Pick random book
                const booksSnap = await getDocs(collection(db, 'books'));
                if (booksSnap.empty) {
                    alert("등록된 단어장이 없습니다.");
                    return;
                }
                const randomBookDoc = booksSnap.docs[Math.floor(Math.random() * booksSnap.docs.length)];
                targetBook = randomBookDoc.data().bookName;
                totalWords = randomBookDoc.data().totalWords || 0;
            } else {
                // Get metadata for selected book
                const booksQuery = query(collection(db, 'books'), where('bookName', '==', targetBook));
                const bookSnap = await getDocs(booksQuery);
                if (!bookSnap.empty) {
                    totalWords = bookSnap.docs[0].data().totalWords || 0;
                }
            }

            let gameWords = [];

            // 2. Fetch Words
            if (totalWords > 0 && totalWords <= 60) {
                // Small book: fetch all
                const q = query(collection(db, 'words'), where('book_name', '==', targetBook));
                const snap = await getDocs(q);
                gameWords = snap.docs.map(d => d.data());
            } else if (totalWords > 60) {
                // Large book: fetch random indices
                const indices = new Set();
                while (indices.size < 50) {
                    indices.add(Math.floor(Math.random() * totalWords) + 1);
                }
                const indexArray = Array.from(indices);

                // Batch queries (max 10 per 'in' clause)
                const batches = [];
                for (let i = 0; i < indexArray.length; i += 10) {
                    batches.push(indexArray.slice(i, i + 10));
                }

                try {
                    const promises = batches.map(batch => {
                        const q = query(collection(db, 'words'), where('book_name', '==', targetBook), where('word_number', 'in', batch));
                        return getDocs(q);
                    });

                    const snapshots = await Promise.all(promises);
                    snapshots.forEach(snap => {
                        snap.docs.forEach(d => gameWords.push(d.data()));
                    });
                } catch (queryError) {
                    console.warn("Survival words index query failed, falling back to client-side filtering:", queryError);
                    const fallbackQuery = query(
                        collection(db, 'words'),
                        where('book_name', '==', targetBook)
                    );
                    const fallbackSnap = await getDocs(fallbackQuery);
                    const allBookWords = fallbackSnap.docs.map(doc => doc.data());

                    // Filter by indices
                    const indicesSet = new Set(indexArray);
                    gameWords = allBookWords.filter(w => indicesSet.has(w.word_number));
                }
            } else {
                // Fallback (metadata missing): fetch all (should be rare if migration ran)
                const q = query(collection(db, 'words'), where('book_name', '==', targetBook));
                const snap = await getDocs(q);
                gameWords = snap.docs.map(d => d.data());
            }

            // Shuffle
            const shuffled = gameWords.sort(() => 0.5 - Math.random()).slice(0, 50);

            await updateDoc(doc(db, 'battles', roomId), {
                status: 'playing',
                gameWords: shuffled,
                startTime: new Date().toISOString(),
                selectedBook: targetBook // Ensure book is set if it was random
            });
        } catch (e) {
            console.error(e);
        }
    };

    const handleLeave = async () => {
        if (window.confirm("나가시겠습니까?")) {
            if (room.hostId === userId) {
                await deleteDoc(doc(db, 'battles', roomId));
            } else {
                const newPlayers = { ...room.players };
                delete newPlayers[userId];
                await updateDoc(doc(db, 'battles', roomId), {
                    players: newPlayers,
                    playerCount: room.playerCount - 1
                });
            }
            navigate('/student/survival');
        }
    };

    if (!room) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">로딩 중...</div>;

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full h-[90vh] bg-gray-900 text-white font-sans overflow-hidden flex rounded-2xl shadow-2xl border border-gray-800">
                {/* Left: My Game Area */}
                <div className="flex-1 relative border-r border-gray-700">
                    {/* Effect Overlay */}
                    {activeEffect === 'fog' && <div className="absolute inset-0 bg-gray-900/90 z-40 backdrop-blur-sm flex items-center justify-center text-4xl font-bold animate-pulse">안개 주의!</div>}
                    {activeEffect === 'flash' && <div className="absolute inset-0 bg-white z-50 animate-ping"></div>}

                    {/* Header */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-30 bg-gradient-to-b from-gray-900 to-transparent">
                        <div className="flex items-center space-x-4">
                            <button onClick={handleLeave} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700"><LogOut className="w-5 h-5" /></button>
                            <div className="flex items-center space-x-2">
                                <Heart className="w-6 h-6 text-red-500 fill-red-500" />
                                <div className="w-32 h-4 bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 transition-all" style={{ width: `${myStatus.hp}%` }}></div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Game Canvas */}
                    <div ref={gameAreaRef} className="absolute inset-0 z-10">
                        {gameState === 'waiting' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/50">
                                <h2 className="text-4xl font-bold mb-4">대기실</h2>
                                <p className="mb-8 text-xl">참가자: {room.playerCount} / {room.maxPlayers}</p>
                                {
                                    room.hostId === userId ? (
                                        <button onClick={handleStartGame} className="px-8 py-4 bg-red-600 rounded-xl font-bold text-xl hover:bg-red-500 transition-all shadow-lg shadow-red-600/50 animate-pulse">
                                            게임 시작
                                        </button>
                                    ) : (
                                        <p className="text-gray-400 animate-pulse">호스트가 시작하기를 기다리는 중...</p>
                                    )
                                }
                            </div >
                        )
                        }

                        {
                            gameState === 'dead' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-red-900/80 backdrop-blur-sm">
                                    <Skull className="w-24 h-24 text-white mb-4" />
                                    <h2 className="text-5xl font-bold mb-2">YOU DIED</h2>
                                    <p className="text-xl text-red-200">관전 모드로 전환됩니다...</p>
                                </div>
                            )
                        }

                        {
                            gameState === 'finished' && winner && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/80 backdrop-blur-md">
                                    <Trophy className="w-32 h-32 text-yellow-400 mb-6 animate-bounce" />
                                    <h2 className="text-4xl font-bold mb-4">게임 종료!</h2>
                                    <p className="text-2xl mb-8">승자: <span className="text-yellow-400 font-bold">{winner.name}</span></p>
                                    <button onClick={() => navigate('/student/survival')} className="px-6 py-3 bg-gray-700 rounded-lg hover:bg-gray-600">로비로 나가기</button>
                                </div>
                            )
                        }

                        {
                            fallingWords.map(fw => (
                                <div key={fw.id} className="absolute transform -translate-x-1/2" style={{ left: `${fw.x}%`, top: `${fw.y}%` }}>
                                    <div className={`px-4 py-2 rounded-xl border-2 ${fw.isDissolving ? 'bg-red-500/50 border-red-500 scale-90 opacity-50' : 'bg-gray-800/80 border-blue-400/50 backdrop-blur-md'}`}>
                                        <span className="text-lg font-bold text-white block">{fw.meaning}</span>
                                        {fw.y > 10 && !fw.isDissolving && (
                                            <div className="flex flex-col items-center mt-1">
                                                <span className="text-xs text-blue-300 font-mono font-bold">{fw.word[0]}...</span>
                                                <span className="text-[10px] text-gray-400">({fw.word.length}글자)</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        }
                    </div >

                    {/* Input Area */}
                    < div className="absolute bottom-0 left-0 right-0 p-6 z-50 bg-gradient-to-t from-gray-900 to-transparent" >
                        <div className="max-w-xl mx-auto flex space-x-4">
                            <input
                                ref={inputRef}
                                type="text"
                                value={userInput}
                                onChange={handleInput}
                                className="flex-1 px-6 py-4 bg-gray-800/90 border-2 border-gray-600 rounded-2xl text-center text-2xl font-bold focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                                placeholder={gameState === 'playing' ? "단어를 입력하세요!" : ""}
                                disabled={gameState !== 'playing'}
                                autoFocus
                            />
                        </div>
                    </div >
                </div >

                {/* Right: Opponents Status */}
                < div className="w-64 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto" >
                    <h3 className="text-gray-400 font-bold mb-4 flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        생존자 ({Object.values(room.players).filter(p => p.alive).length})
                    </h3>
                    <div className="space-y-3">
                        {Object.values(room.players).sort((a, b) => b.score - a.score).map(player => (
                            <div key={player.id} className={`p-3 rounded-xl border ${player.alive ? 'bg-gray-700 border-gray-600' : 'bg-gray-900 border-gray-800 opacity-50'} ${player.id === userId ? 'ring-2 ring-blue-500' : ''}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`font-bold ${player.id === userId ? 'text-blue-400' : 'text-white'}`}>
                                        {player.name} {player.id === userId && '(나)'}
                                    </span>
                                    {!player.alive && <Skull className="w-4 h-4 text-gray-500" />}
                                </div>
                                {player.alive && (
                                    <>
                                        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden mb-1">
                                            <div className="h-full bg-red-500" style={{ width: `${player.hp}%` }}></div>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-400">
                                            <span>HP {player.hp}</span>
                                            <span>{player.score}점</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div >
            </div>
        </div>
    );
}

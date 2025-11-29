import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, deleteDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Users, Play, LogOut, Trophy, Zap, CheckCircle, XCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function BattleRoom() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [room, setRoom] = useState(null);
    const [words, setWords] = useState([]);
    const [currentWord, setCurrentWord] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [timeLeft, setTimeLeft] = useState(0);
    const [feedback, setFeedback] = useState(null);
    const [winner, setWinner] = useState(null);

    const userId = localStorage.getItem('userId');
    const inputRef = useRef(null);
    const timerRef = useRef(null);



    const triggerWinConfetti = () => {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    };

    // Listen to room updates
    useEffect(() => {
        const roomRef = doc(db, 'battles', roomId);
        const unsubscribe = onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRoom(data);

                // Handle Game Over
                if (data.status === 'finished' && !winner) {
                    const players = Object.values(data.players);
                    const sorted = players.sort((a, b) => b.score - a.score);
                    setWinner(sorted[0]);
                    if (sorted[0].id === userId) {
                        triggerWinConfetti();
                    }
                }
            } else {
                alert('방이 삭제되었습니다.');
                navigate('/student/battle');
            }
        });

        return () => unsubscribe();
    }, [roomId, navigate, userId, winner]);

    const endGame = useCallback(async () => {
        await updateDoc(doc(db, 'battles', roomId), {
            status: 'finished'
        });
    }, [roomId]);

    // Sync current word based on room state
    useEffect(() => {
        if (room?.status === 'playing') {
            // If gameWords exists in room, use it
            if (room.gameWords && room.gameWords.length > 0) {
                setTimeout(() => setWords(room.gameWords), 0);
            }

            const index = room.currentWordIndex || 0;
            if (words.length > 0 && index < words.length) {
                setTimeout(() => {
                    setCurrentWord(words[index]);
                    setUserInput('');
                    setFeedback(null);
                }, 0);
                inputRef.current?.focus();

                // Difficulty Logic
                if (room.difficulty === 'hard') {
                    setTimeout(() => setTimeLeft(10), 0); // 10 seconds for hard mode
                }
            } else if (room.hostId === userId && words.length > 0 && index >= words.length) {
                endGame();
            }
        }
    }, [room?.currentWordIndex, room?.gameWords, words.length, room?.status, room?.difficulty, room?.hostId, userId, words, endGame]);

    // Timer for Hard Mode
    useEffect(() => {
        if (room?.difficulty === 'hard' && room?.status === 'playing' && timeLeft > 0 && !feedback) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        // Time over logic - only host triggers next word to avoid race conditions
                        if (room.hostId === userId) {
                            updateDoc(doc(db, 'battles', roomId), {
                                currentWordIndex: (room.currentWordIndex || 0) + 1
                            });
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timerRef.current);
        }
    }, [timeLeft, room?.difficulty, room?.status, feedback, room?.hostId, room?.currentWordIndex, roomId, userId]);

    const handleStartGame = async () => {
        if (room.playerCount < 2) {
            alert('최소 2명의 플레이어가 필요합니다.');
            return;
        }

        try {
            // Fetch words (Optimized)
            let bookName = room?.selectedBook || '기본';

            // Simplified approach: Query books collection by name (and academy if possible)
            // If we don't have academyId in room, we might have issues. 
            // Let's assume we can fetch all words for the book if metadata is missing (fallback), 
            // BUT we want to avoid that.

            // Let's try to fetch the book metadata first.
            const booksQuery = query(collection(db, 'books'), where('name', '==', bookName));
            const booksSnap = await getDocs(booksQuery);

            let targetWords = [];

            if (!booksSnap.empty) {
                const bookData = booksSnap.docs[0].data();
                const totalWords = bookData.totalWords || 0;

                if (totalWords > 0) {
                    // 2. Generate 10 unique random indices
                    const count = Math.min(10, totalWords);
                    const indices = new Set();
                    while (indices.size < count) {
                        indices.add(Math.floor(Math.random() * totalWords) + 1); // 1-based index
                    }

                    // 3. Fetch words by indices
                    // Firestore 'in' limit is 10. Perfect.
                    try {
                        const wordsQuery = query(
                            collection(db, 'words'),
                            where('book_name', '==', bookName),
                            where('word_number', 'in', [...indices])
                        );
                        const wordsSnap = await getDocs(wordsQuery);
                        targetWords = wordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    } catch (queryError) {
                        console.warn("Battle words index query failed, falling back to client-side filtering:", queryError);
                        const fallbackQuery = query(
                            collection(db, 'words'),
                            where('book_name', '==', bookName)
                        );
                        const fallbackSnap = await getDocs(fallbackQuery);
                        const allBookWords = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                        // Filter by indices
                        const indicesSet = new Set([...indices]);
                        targetWords = allBookWords.filter(w => indicesSet.has(w.word_number));
                    }
                }
            }

            // Fallback: If no metadata or words found via index (e.g. gaps), fetch all (legacy behavior but safer)
            if (targetWords.length < 10) {
                const q = query(collection(db, 'words'), where('book_name', '==', bookName));
                const snapshot = await getDocs(q);
                const allWords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                targetWords = allWords.sort(() => 0.5 - Math.random()).slice(0, 10);
            }

            await updateDoc(doc(db, 'battles', roomId), {
                status: 'playing',
                currentWordIndex: 0,
                gameWords: targetWords, // Store words in Firestore
                startTime: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error starting game:", error);
            alert("게임을 시작하는 중 오류가 발생했습니다.");
        }
    };

    const handleLeave = async () => {
        if (window.confirm('정말 나가시겠습니까?')) {
            const roomRef = doc(db, 'battles', roomId);

            if (room.hostId === userId) {
                // Host leaves -> delete room
                await deleteDoc(roomRef);
            } else {
                // Player leaves -> remove from players
                const newPlayers = { ...room.players };
                delete newPlayers[userId];
                await updateDoc(roomRef, {
                    players: newPlayers,
                    playerCount: room.playerCount - 1
                });
            }
            navigate('/student/battle');
        }
    };

    const handlePass = async () => {
        if (!currentWord || feedback) return;

        const myPlayer = room.players[userId];
        const maxPasses = Math.floor(words.length * 0.2);
        const currentPasses = myPlayer.passCount || 0;

        if (currentPasses >= maxPasses) {
            alert(`패스 횟수를 초과했습니다. (최대 ${maxPasses}회)`);
            return;
        }

        if (window.confirm(`단어를 패스하시겠습니까? 점수가 50점 차감됩니다.\n(남은 패스: ${maxPasses - currentPasses - 1}회)`)) {
            const newScore = myPlayer.score - 50;

            await updateDoc(doc(db, 'battles', roomId), {
                [`players.${userId}.score`]: newScore,
                [`players.${userId}.passCount`]: currentPasses + 1,
                currentWordIndex: (room.currentWordIndex || 0) + 1
            });

            setFeedback('pass');
            setTimeout(() => setFeedback(null), 500);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentWord || feedback) return;

        if (userInput.trim().toLowerCase() === currentWord.english.toLowerCase()) {
            // Correct!
            setFeedback('correct');

            // Update score and progress
            const myPlayer = room.players[userId];
            const newScore = myPlayer.score + 100;

            await updateDoc(doc(db, 'battles', roomId), {
                [`players.${userId}.score`]: newScore,
                currentWordIndex: (room.currentWordIndex || 0) + 1,
                lastWinner: userId // To show who won this round
            });

        } else {
            setFeedback('incorrect');
            setTimeout(() => setFeedback(null), 500);
        }
    };





    const refreshRoom = async () => {
        try {
            const roomRef = doc(db, 'battles', roomId);
            const docSnap = await getDoc(roomRef);
            if (docSnap.exists()) {
                setRoom(docSnap.data());
            }
        } catch (error) {
            console.error("Error refreshing room:", error);
        }
    };

    if (!room) return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;

    const myPlayer = room.players[userId];
    const opponent = Object.values(room.players).find(p => p.id !== userId);
    const maxPasses = Math.floor(words.length * 0.2);
    const currentPasses = myPlayer?.passCount || 0;

    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans p-4">
            {/* Header */}
            <header className="flex justify-between items-center mb-8 max-w-4xl mx-auto">
                <div className="flex items-center space-x-4">
                    <button onClick={handleLeave} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <LogOut className="w-6 h-6 text-gray-400" />
                    </button>
                    <div>
                        <div className="flex items-center space-x-2">
                            <h1 className="text-xl font-bold">{room.name}</h1>
                            <span className="text-xs text-gray-600 font-mono">#{roomId.slice(0, 6)}</span>
                        </div>
                        <span className="text-sm text-gray-400">
                            {room.status === 'waiting' ? '대기 중...' : room.status === 'playing' ? '게임 진행 중' : '게임 종료'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <button onClick={refreshRoom} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors" title="새로고침">
                        <Zap className="w-4 h-4 text-yellow-400" />
                    </button>
                    <div className="flex items-center space-x-2 bg-gray-800 px-4 py-2 rounded-full">
                        <Users className="w-5 h-5 text-indigo-400" />
                        <span className="font-bold">{room.playerCount} / {room.maxPlayers}</span>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto">
                {room.status === 'waiting' && (
                    <div className="bg-gray-800 rounded-2xl p-8 text-center shadow-xl border border-gray-700">
                        <div className="flex justify-center space-x-12 mb-12">
                            {/* Player 1 (Me) */}
                            <div className="flex flex-col items-center">
                                <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/30">
                                    <span className="text-3xl font-bold">{myPlayer?.name[0]}</span>
                                </div>
                                <span className="text-xl font-bold">{myPlayer?.name} (나)</span>
                                <span className="text-green-400 text-sm mt-1">준비 완료</span>
                            </div>

                            {/* VS */}
                            <div className="flex items-center">
                                <span className="text-4xl font-black text-gray-600 italic">VS</span>
                            </div>

                            {/* Player 2 (Opponent) */}
                            <div className="flex flex-col items-center">
                                {opponent ? (
                                    <>
                                        <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-red-500/30">
                                            <span className="text-3xl font-bold">{opponent.name[0]}</span>
                                        </div>
                                        <span className="text-xl font-bold">{opponent.name}</span>
                                        <span className="text-green-400 text-sm mt-1">준비 완료</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-gray-500 animate-pulse">
                                            <Users className="w-8 h-8 text-gray-500" />
                                        </div>
                                        <span className="text-gray-500">상대방 기다리는 중...</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {room.hostId === userId && (
                            <button
                                onClick={handleStartGame}
                                disabled={!opponent}
                                className={`
                                    px-8 py-4 rounded-xl font-bold text-xl transition-all transform hover:scale-105
                                    ${opponent
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/50'
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                                `}
                            >
                                {opponent ? '게임 시작!' : '플레이어 대기 중...'}
                            </button>
                        )}
                        {room.hostId !== userId && (
                            <div className="text-gray-400 animate-pulse">
                                방장이 게임을 시작하기를 기다리고 있습니다...
                            </div>
                        )}
                    </div>
                )}

                {room.status === 'playing' && currentWord && (
                    <div className="space-y-8">
                        {/* Score Board */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className={`bg-indigo-900/50 p-4 rounded-xl border-2 ${room.lastWinner === userId ? 'border-yellow-400' : 'border-indigo-500/30'}`}>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-indigo-200">나 ({myPlayer.name})</span>
                                    <span className="text-2xl font-bold text-white">{myPlayer.score}</span>
                                </div>
                                <div className="w-full bg-gray-700 h-2 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-indigo-500 h-full transition-all" style={{ width: `${(myPlayer.score / 1000) * 100}%` }}></div>
                                </div>
                            </div>
                            <div className={`bg-red-900/50 p-4 rounded-xl border-2 ${room.lastWinner === opponent?.id ? 'border-yellow-400' : 'border-red-500/30'}`}>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-red-200">상대방 ({opponent?.name})</span>
                                    <span className="text-2xl font-bold text-white">{opponent?.score}</span>
                                </div>
                                <div className="w-full bg-gray-700 h-2 rounded-full mt-2 overflow-hidden">
                                    <div className="bg-red-500 h-full transition-all" style={{ width: `${(opponent?.score / 1000) * 100}%` }}></div>
                                </div>
                            </div>
                        </div>

                        {/* Game Area */}
                        <div className="bg-gray-800 rounded-3xl p-12 text-center shadow-2xl border border-gray-700 relative overflow-hidden">
                            {/* Feedback Overlay */}
                            {feedback && (
                                <div className={`absolute inset-0 flex items-center justify-center z-10 ${feedback === 'correct' ? 'bg-green-500/20' : feedback === 'pass' ? 'bg-yellow-500/20' : 'bg-red-500/20'} backdrop-blur-sm transition-all`}>
                                    {feedback === 'correct' ? (
                                        <CheckCircle className="w-32 h-32 text-green-400 animate-bounce" />
                                    ) : feedback === 'pass' ? (
                                        <div className="text-center">
                                            <span className="text-6xl font-bold text-yellow-400 block mb-2">PASS!</span>
                                            <span className="text-xl text-yellow-200">-50점</span>
                                        </div>
                                    ) : (
                                        <XCircle className="w-32 h-32 text-red-400 animate-shake" />
                                    )}
                                </div>
                            )}

                            <div className="mb-8">
                                <span className="text-gray-400 text-sm uppercase tracking-widest">Current Word</span>
                            </div>

                            <h2 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">{currentWord.korean}</h2>

                            {room.difficulty === 'easy' && (
                                <div className="mb-6 text-indigo-300 font-mono text-xl">
                                    Hint: {currentWord.english[0]}
                                    {currentWord.english.slice(1).split('').map(() => '_').join(' ')}
                                </div>
                            )}

                            {room.difficulty === 'hard' && (
                                <div className="mb-6">
                                    <div className="w-full bg-gray-700 h-4 rounded-full overflow-hidden relative">
                                        <div
                                            className={`h-full transition-all duration-1000 ${timeLeft <= 3 ? 'bg-red-500' : 'bg-green-500'}`}
                                            style={{ width: `${(timeLeft / 10) * 100}%` }}
                                        ></div>
                                    </div>
                                    <p className={`mt-2 font-bold ${timeLeft <= 3 ? 'text-red-400' : 'text-green-400'}`}>
                                        남은 시간: {timeLeft}초
                                    </p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="max-w-md mx-auto relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    className="w-full bg-gray-900 border-2 border-gray-600 rounded-xl px-6 py-4 text-2xl text-center focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all"
                                    placeholder="영어 단어를 입력하세요"
                                    autoFocus
                                />
                                <div className="flex space-x-2 mt-4">
                                    <button
                                        type="button"
                                        onClick={handlePass}
                                        disabled={currentPasses >= maxPasses}
                                        className={`flex-1 py-3 rounded-xl font-bold transition-colors ${currentPasses >= maxPasses
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                                            }`}
                                    >
                                        패스 ({currentPasses}/{maxPasses})
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] py-3 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-500 transition-colors text-white"
                                    >
                                        입력
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {room.status === 'finished' && winner && (
                    <div className="text-center py-12 animate-scale-in">
                        <Trophy className="w-32 h-32 text-yellow-400 mx-auto mb-6 animate-bounce" />
                        <h2 className="text-4xl font-bold mb-4">게임 종료!</h2>
                        <p className="text-2xl text-gray-300 mb-8">
                            승자는 <span className="text-yellow-400 font-bold">{winner.name}</span>입니다!
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={() => navigate('/student/battle')}
                                className="px-8 py-3 bg-gray-700 rounded-xl font-bold hover:bg-gray-600 transition-colors"
                            >
                                로비로 돌아가기
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { socket } from '../api/client';
import { Users, Trophy, Timer, ArrowRight, XCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function BattleRoom() {
    const location = useLocation();
    const navigate = useNavigate();
    const { roomId, username } = location.state || {};

    const [players, setPlayers] = useState([]);
    const [host, setHost] = useState('');
    const [status, setStatus] = useState('waiting'); // waiting, playing, finished
    const [currentWord, setCurrentWord] = useState(null);
    const [input, setInput] = useState('');
    const [logs, setLogs] = useState([]);
    const [timeLeft, setTimeLeft] = useState(60);
    const [winner, setWinner] = useState(null);

    const logsEndRef = useRef(null);

    useEffect(() => {
        if (!roomId || !username) {
            navigate('/student/battle');
            return;
        }

        // Socket Event Listeners
        socket.on('room_update', ({ players, host }) => {
            setPlayers(players);
            setHost(host);
        });

        socket.on('player_left', (id) => {
            setLogs(prev => [...prev, { type: 'system', text: '플레이어가 퇴장했습니다.' }]);
        });

        socket.on('new_host', (newHostId) => {
            setHost(newHostId);
            setLogs(prev => [...prev, { type: 'system', text: '방장이 변경되었습니다.' }]);
        });

        socket.on('game_started', () => {
            setStatus('playing');
            setLogs(prev => [...prev, { type: 'system', text: '게임이 시작되었습니다!' }]);
        });

        socket.on('new_word', (word) => {
            setCurrentWord(word);
            setInput('');
        });

        socket.on('correct_answer', ({ username, score, word }) => {
            setLogs(prev => [...prev, { type: 'success', text: `${username}님이 정답을 맞췄습니다! (+10점)` }]);
            setPlayers(prev => prev.map(p => p.username === username ? { ...p, score } : p));
        });

        socket.on('game_over', ({ scores }) => {
            setStatus('finished');
            setPlayers(scores);
            const sorted = [...scores].sort((a, b) => b.score - a.score);
            setWinner(sorted[0]);
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        });

        socket.on('error', (msg) => {
            alert(msg);
        });

        return () => {
            socket.off('room_update');
            socket.off('player_left');
            socket.off('new_host');
            socket.off('game_started');
            socket.off('new_word');
            socket.off('correct_answer');
            socket.off('game_over');
            socket.off('error');
            socket.emit('leave_room', roomId);
        };
    }, [roomId, username, navigate]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const startGame = () => {
        socket.emit('start_game', { roomId, bookName: '기본', count: 20 });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        socket.emit('submit_answer', { roomId, answer: input });
        setInput('');
    };

    if (!roomId) return null;

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700">
                <div className="flex items-center space-x-4">
                    <div className="bg-indigo-600 px-4 py-2 rounded-lg font-bold font-mono tracking-wider">
                        CODE: {roomId}
                    </div>
                    <div className="flex items-center text-slate-400">
                        <Users className="w-5 h-5 mr-2" />
                        {players.length}명 접속 중
                    </div>
                </div>
                <button
                    onClick={() => navigate('/student/battle')}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                    <XCircle className="w-6 h-6 text-slate-400 hover:text-red-400" />
                </button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Players List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 h-full">
                        <h2 className="text-xl font-bold mb-4 flex items-center">
                            <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
                            순위표
                        </h2>
                        <div className="space-y-3">
                            {[...players].sort((a, b) => b.score - a.score).map((player, index) => (
                                <div
                                    key={player.id}
                                    className={`flex items-center justify-between p-4 rounded-xl border ${player.id === socket.id ? 'bg-indigo-900/50 border-indigo-500' : 'bg-slate-700/50 border-slate-600'}`}
                                >
                                    <div className="flex items-center">
                                        <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold mr-3 ${index === 0 ? 'bg-yellow-500 text-slate-900' : 'bg-slate-600 text-slate-300'}`}>
                                            {index + 1}
                                        </span>
                                        <span className="font-medium">{player.username}</span>
                                        {player.id === host && <span className="ml-2 text-xs bg-indigo-500 px-2 py-0.5 rounded text-white">HOST</span>}
                                    </div>
                                    <span className="font-bold text-indigo-300">{player.score}점</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Center: Game Area */}
                <div className="lg:col-span-2 flex flex-col space-y-6">
                    <div className="flex-1 bg-slate-800 rounded-2xl p-8 border border-slate-700 flex flex-col items-center justify-center relative overflow-hidden">
                        {status === 'waiting' && (
                            <div className="text-center z-10">
                                <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                                    <Users className="w-10 h-10 text-white" />
                                </div>
                                <h2 className="text-3xl font-bold mb-4">대기 중...</h2>
                                <p className="text-slate-400 mb-8">다른 플레이어를 기다리고 있습니다.</p>
                                {host === socket.id ? (
                                    <button
                                        onClick={startGame}
                                        className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl font-bold text-xl shadow-lg transition-all transform hover:scale-105"
                                    >
                                        게임 시작
                                    </button>
                                ) : (
                                    <p className="text-indigo-400 animate-pulse">방장이 게임을 시작하기를 기다리는 중...</p>
                                )}
                            </div>
                        )}

                        {status === 'playing' && currentWord && (
                            <div className="w-full max-w-2xl z-10">
                                <div className="text-center mb-12">
                                    <span className="text-indigo-400 font-medium tracking-wider uppercase mb-2 block">Current Word</span>
                                    <h1 className="text-5xl md:text-7xl font-black text-white drop-shadow-2xl mb-4 animate-bounce-in">
                                        {currentWord.english}
                                    </h1>
                                    <p className="text-slate-400">위 단어의 뜻을 입력하세요!</p>
                                </div>

                                <form onSubmit={handleSubmit} className="relative">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="정답 입력..."
                                        autoFocus
                                        className="w-full p-6 pr-16 bg-slate-900/50 border-2 border-slate-600 rounded-2xl text-2xl text-center focus:border-indigo-500 focus:bg-slate-900 outline-none transition-all shadow-inner"
                                    />
                                    <button
                                        type="submit"
                                        className="absolute right-3 top-3 bottom-3 px-6 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors"
                                    >
                                        <ArrowRight className="w-6 h-6" />
                                    </button>
                                </form>
                            </div>
                        )}

                        {status === 'finished' && winner && (
                            <div className="text-center z-10 animate-fade-in">
                                <Trophy className="w-24 h-24 text-yellow-400 mx-auto mb-6 animate-bounce" />
                                <h2 className="text-4xl font-bold mb-2">게임 종료!</h2>
                                <p className="text-2xl text-indigo-300 mb-8">
                                    우승자: <span className="text-white font-bold">{winner.username}</span> ({winner.score}점)
                                </p>
                                <button
                                    onClick={() => navigate('/student/battle')}
                                    className="px-8 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors"
                                >
                                    로비로 돌아가기
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Game Logs */}
                    <div className="h-48 bg-slate-900/50 rounded-xl border border-slate-700/50 p-4 overflow-y-auto custom-scrollbar">
                        {logs.map((log, i) => (
                            <div key={i} className={`mb-2 text-sm ${log.type === 'success' ? 'text-green-400' : log.type === 'system' ? 'text-slate-500' : 'text-slate-300'}`}>
                                {log.text}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
}

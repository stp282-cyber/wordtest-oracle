import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Skull, Play, LogIn } from 'lucide-react';
import { socket } from '../api/client';

export default function SurvivalLobby() {
    const navigate = useNavigate();
    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState('');

    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        if (storedUsername) {
            setUsername(storedUsername);
        }
    }, []);

    const createRoom = () => {
        const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        joinRoom(newRoomId);
    };

    const joinRoom = (id) => {
        if (!username) {
            alert('닉네임을 설정해주세요.');
            return;
        }
        const targetRoomId = id || roomId;
        if (!targetRoomId) {
            alert('방 코드를 입력해주세요.');
            return;
        }

        socket.emit('join_room', { roomId: targetRoomId, username, gameType: 'survival' });
        navigate('/student/survival/game', { state: { roomId: targetRoomId, username } });
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
            <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
                <div className="flex items-center justify-center mb-8">
                    <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30">
                        <Skull className="w-8 h-8 text-white" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-center mb-2">서바이벌</h1>
                <p className="text-slate-400 text-center mb-8">최후의 1인이 될 때까지 살아남으세요!</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">닉네임</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="닉네임을 입력하세요"
                            className="w-full p-4 bg-slate-900 border border-slate-700 rounded-xl focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                        />
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-slate-800 text-slate-500">방 만들기 또는 참가하기</span>
                        </div>
                    </div>

                    <button
                        onClick={createRoom}
                        className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 rounded-xl font-bold text-lg transition-all shadow-lg flex items-center justify-center"
                    >
                        <Play className="w-5 h-5 mr-2" />
                        새로운 방 만들기
                    </button>

                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                            placeholder="방 코드 입력"
                            className="flex-1 p-4 bg-slate-900 border border-slate-700 rounded-xl focus:border-red-500 outline-none transition-all text-center uppercase tracking-widest font-mono"
                        />
                        <button
                            onClick={() => joinRoom()}
                            className="px-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors"
                        >
                            <LogIn className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => navigate('/student')}
                    className="w-full mt-6 py-3 text-slate-400 hover:text-white transition-colors flex items-center justify-center"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    대시보드로 돌아가기
                </button>
            </div>
        </div>
    );
}

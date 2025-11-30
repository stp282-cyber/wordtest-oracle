import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function SurvivalLobby() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
            <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 text-center shadow-xl border border-slate-700">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
                <h1 className="text-2xl font-bold mb-4">서비스 점검 중</h1>
                <p className="text-slate-400 mb-8">
                    서바이벌 게임은 현재 시스템 업그레이드 중입니다.<br />
                    더 나은 서비스로 찾아뵙겠습니다.
                </p>
                <button
                    onClick={() => navigate('/student')}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold transition-colors flex items-center justify-center"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    돌아가기
                </button>
            </div>
        </div>
    );
}

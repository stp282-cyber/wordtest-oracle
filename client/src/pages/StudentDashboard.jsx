import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, History, Trophy, Star, LogOut, User, Settings, Bell } from 'lucide-react';
import { api } from '../api/client';

export default function StudentDashboard() {
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const userId = localStorage.getItem('userId');
    const userName = localStorage.getItem('userName');

    useEffect(() => {
        const fetchDashboard = async () => {
            if (!userId) return;
            try {
                const response = await api.get(`/dashboard/student/${userId}`);
                setDashboardData(response.data);
            } catch (err) {
                console.error("Error fetching dashboard data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, [userId]);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-indigo-600 p-2 rounded-lg">
                            <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-gray-800 tracking-tight">Eastern WordTest</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="hidden md:flex items-center space-x-2 px-3 py-1 bg-indigo-50 rounded-full text-indigo-700 text-sm font-medium">
                            <User className="w-4 h-4" />
                            <span>{userName} 학생</span>
                        </div>
                        <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 transition-colors rounded-full hover:bg-red-50">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Welcome Section */}
                <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                        <h1 className="text-3xl font-bold mb-2">반가워요, {userName} 학생! 👋</h1>
                        <p className="text-indigo-100 mb-6">오늘도 힘차게 단어 공부를 시작해볼까요?</p>
                        <button
                            onClick={() => navigate('/student/test')}
                            className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all flex items-center space-x-2"
                        >
                            <PlayCircle className="w-5 h-5" />
                            <span>오늘의 학습 시작하기</span>
                        </button>
                    </div>
                    <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                        <BookOpen className="w-64 h-64" />
                    </div>
                </section>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
                        <div className="p-3 bg-green-100 text-green-600 rounded-xl">
                            <Trophy className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">총 학습 횟수</p>
                            <p className="text-2xl font-bold text-gray-800">{dashboardData?.history?.length || 0}회</p>
                        </div>
                    </div>
                    {/* 추가 통계는 나중에 구현 */}
                </div>

                {/* Recent History */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
                            <History className="w-5 h-5 text-indigo-600" />
                            <span>최근 학습 기록</span>
                        </h2>
                        <button
                            onClick={() => navigate('/student/history')}
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            전체보기
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {dashboardData?.history?.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                                {dashboardData.history.map((item, idx) => (
                                    <div key={idx} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-800">{new Date(item.DATE_TAKEN).toLocaleDateString()}</p>
                                            <p className="text-sm text-gray-500">{item.SCORE}점</p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${item.SCORE >= 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {item.SCORE >= 80 ? '통과' : '재시험 필요'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                아직 학습 기록이 없습니다.
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}

function PlayCircle(props) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
    );
}

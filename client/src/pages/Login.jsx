import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login } from '../api/client';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Branding State
    const [branding, setBranding] = useState({
        title: 'Eastern WordTest',
        subtitle: '이스턴 영어 공부방'
    });

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { user } = await login(email, password);

            // 로컬 스토리지에 사용자 정보 저장
            // Oracle DB 컬럼명은 대문자일 수 있으므로 확인 필요
            // server.js에서 outFormat: oracledb.OUT_FORMAT_OBJECT 사용
            const userId = user.ID || user.id;
            const userName = user.USERNAME || user.username;
            const userRole = user.ROLE || user.role;

            localStorage.setItem('userId', userId);
            localStorage.setItem('userName', userName);
            localStorage.setItem('userRole', userRole);

            if (userRole === 'admin' || userRole === 'super_admin') {
                navigate('/admin');
            } else {
                navigate('/student');
            }
        } catch (err) {
            console.error(err);
            if (err.response && err.response.status === 401) {
                setError('아이디 또는 비밀번호가 올바르지 않습니다.');
            } else {
                setError('로그인 중 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
            <div className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-white rounded-2xl shadow-xl">
                <div className="flex flex-col items-center mb-2">
                    <div className="mb-6 text-center transform hover:scale-105 transition-transform duration-300">
                        <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 tracking-tighter mb-2 drop-shadow-sm">
                            {branding.title}
                        </h1>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-600 tracking-wide">
                            {branding.subtitle}
                        </h2>
                    </div>
                    <p className="text-gray-500 text-sm">
                        로그인하여 학습을 시작하세요.
                    </p>
                </div>

                {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">이메일</label>
                        <input
                            type="email"
                            required
                            placeholder="예: student1@wordtest.com"
                            className="w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">비밀번호</label>
                        <input
                            type="password"
                            required
                            placeholder="비밀번호 입력"
                            className="w-full px-4 py-2 mt-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 transition-all font-medium flex justify-center items-center"
                    >
                        {loading ? '로그인 중...' : '로그인'}
                    </button>
                </form>
            </div>
        </div>
    );
}

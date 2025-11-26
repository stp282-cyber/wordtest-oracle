import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Home } from 'lucide-react';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const role = localStorage.getItem('role');
    const username = localStorage.getItem('username');

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const handleGoHome = () => {
        if (role === 'admin') navigate('/admin');
        else if (role === 'student') navigate('/student');
        else navigate('/login');
    };

    // Don't show layout on login page
    if (location.pathname === '/login') {
        return <Outlet />;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center cursor-pointer" onClick={handleGoHome}>
                            <span className="text-xl font-bold text-indigo-600">Eastern WordTest</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-gray-600 text-sm">
                                {role === 'admin' ? '선생님' : '학생'}: <b>{localStorage.getItem('name') || username}</b>
                            </span>
                            <button
                                onClick={handleGoHome}
                                className="p-2 text-gray-500 hover:text-indigo-600 transition-colors"
                                title="메인 메뉴"
                            >
                                <Home className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleLogout}
                                className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                                title="로그아웃"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
            <main>
                <Outlet />
            </main>
        </div>
    );
}

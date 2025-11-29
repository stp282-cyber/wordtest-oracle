import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    BookOpen, Users, Megaphone, DollarSign,
    Download, UserCog, Menu, X, GraduationCap, School
} from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function AdminMenu() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [backingUp, setBackingUp] = useState(false);

    const menuItems = [
        { path: '/admin/lessons', label: '수업 관리', icon: BookOpen, color: 'bg-indigo-600' },
        { path: '/admin/words', label: '단어 관리', icon: GraduationCap, color: 'bg-emerald-600' },
        { path: '/admin/students', label: '학생 관리', icon: Users, color: 'bg-blue-600' },
        { path: '/admin/classes', label: '반 관리', icon: School, color: 'bg-orange-500' },
        { path: '/admin/announcements', label: '공지 관리', icon: Megaphone, color: 'bg-purple-600' },
        { path: '/admin/dollars', label: '달러 관리', icon: DollarSign, color: 'bg-green-600' },
        { path: '/admin/settings', label: '학원 설정', icon: UserCog, color: 'bg-gray-800' },
    ];

    const handleBackup = async () => {
        if (!window.confirm('모든 데이터를 백업하시겠습니까? (시간이 걸릴 수 있습니다)')) return;

        setBackingUp(true);
        try {
            const collections = ['users', 'classes', 'words', 'test_results', 'academies', 'announcements', 'chats'];
            const backupData = {};

            for (const colName of collections) {
                const querySnapshot = await getDocs(collection(db, colName));
                backupData[colName] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert('백업이 완료되었습니다.');
        } catch (err) {
            console.error("Backup failed:", err);
            alert('백업 중 오류가 발생했습니다: ' + err.message);
        } finally {
            setBackingUp(false);
        }
    };

    return (
        <div className="bg-white border-b border-gray-200 shadow-sm mb-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-14">
                    <div className="flex items-center">
                        <span className="font-bold text-gray-700 text-lg sm:hidden">관리 메뉴</span>
                    </div>

                    {/* Mobile menu button */}
                    <div className="flex items-center sm:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                        >
                            {isOpen ? (
                                <X className="block h-6 w-6" aria-hidden="true" />
                            ) : (
                                <Menu className="block h-6 w-6" aria-hidden="true" />
                            )}
                        </button>
                    </div>

                    {/* Desktop menu */}
                    <div className="hidden sm:flex sm:flex-wrap sm:gap-2 py-2">
                        {menuItems.map((item) => (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`
                                    flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${location.pathname === item.path
                                        ? `${item.color} text-white shadow-md`
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }
                                `}
                            >
                                <item.icon className={`w-4 h-4 mr-2 ${location.pathname === item.path ? 'text-white' : 'text-gray-500'}`} />
                                {item.label}
                            </button>
                        ))}
                        {/* Backup Button */}
                        <button
                            onClick={handleBackup}
                            disabled={backingUp}
                            className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4 mr-2 text-gray-500" />
                            {backingUp ? '백업 중...' : '데이터 백업'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isOpen && (
                <div className="sm:hidden border-t border-gray-200">
                    <div className="pt-2 pb-3 space-y-1 px-2">
                        {menuItems.map((item) => (
                            <button
                                key={item.path}
                                onClick={() => {
                                    navigate(item.path);
                                    setIsOpen(false);
                                }}
                                className={`
                                    flex items-center w-full px-3 py-3 rounded-md text-base font-medium
                                    ${location.pathname === item.path
                                        ? `${item.color} text-white`
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }
                                `}
                            >
                                <item.icon className={`w-5 h-5 mr-3 ${location.pathname === item.path ? 'text-white' : 'text-gray-500'}`} />
                                {item.label}
                            </button>
                        ))}
                        <button
                            onClick={() => {
                                handleBackup();
                                setIsOpen(false);
                            }}
                            disabled={backingUp}
                            className="flex items-center w-full px-3 py-3 rounded-md text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50"
                        >
                            <Download className="w-5 h-5 mr-3 text-gray-500" />
                            {backingUp ? '백업 중...' : '데이터 백업'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

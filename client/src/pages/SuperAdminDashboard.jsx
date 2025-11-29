import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, where, setDoc, getDoc } from 'firebase/firestore';
import { Building, Plus, Users, LogOut, Globe, Trash2 } from 'lucide-react';


export default function SuperAdminDashboard() {
    const [academies, setAcademies] = useState([]);
    const [newAcademyName, setNewAcademyName] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Debugging state
    const [debugRole, setDebugRole] = useState(null);
    const [currentUserEmail, setCurrentUserEmail] = useState('');

    useEffect(() => {
        fetchAcademies();

        const unsubscribe = auth.onAuthStateChanged(user => {
            if (user) {
                setCurrentUserEmail(user.email);
                checkMyRole(user.uid);
            } else {
                setCurrentUserEmail('');
                setDebugRole(null);
            }
        });

        return () => unsubscribe();
    }, []);

    const checkMyRole = async (uid) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
                setDebugRole(userDoc.data().role);
            }
        } catch (e) {
            console.error("Error checking role:", e);
        }
    };

    const handleForceSuperAdmin = async () => {
        if (!auth.currentUser) return;
        try {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                role: 'super_admin'
            });
            alert("Role updated to super_admin. Please refresh the page.");
            window.location.reload();
        } catch (e) {
            console.error("Error forcing super admin:", e);
            alert("Failed to update role: " + e.message);
        }
    };

    const fetchAcademies = async () => {
        try {
            const q = query(collection(db, 'academies'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAcademies(data);
        } catch (error) {
            console.error("Error fetching academies:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAcademy = async (e) => {
        e.preventDefault();
        if (!newAcademyName.trim()) return;

        if (!confirm(`'${newAcademyName}' 학원을 생성하시겠습니까?`)) return;

        try {
            await addDoc(collection(db, 'academies'), {
                name: newAcademyName,
                plan: 'basic',
                createdAt: new Date().toISOString(),
                isActive: true
            });
            setNewAcademyName('');
            fetchAcademies();
            alert('학원이 생성되었습니다.');
        } catch (error) {
            console.error("Error creating academy:", error);
            alert('학원 생성 실패');
        }
    };

    const handleDeleteAcademy = async (id, name) => {
        if (!confirm(`정말 '${name}' 학원을 삭제하시겠습니까?\n소속된 모든 데이터(학생, 단어 등)는 유지되지만 접근이 불가능해질 수 있습니다.`)) return;

        try {
            await deleteDoc(doc(db, 'academies', id));
            fetchAcademies();
        } catch (error) {
            console.error("Error deleting academy:", error);
            alert('삭제 실패');
        }
    };

    const handleLogout = () => {
        auth.signOut();
        localStorage.clear();
        navigate('/login');
    };

    const [selectedAcademy, setSelectedAcademy] = useState(null);
    const [academyAdmins, setAcademyAdmins] = useState([]);
    const [searchEmail, setSearchEmail] = useState('');
    const [foundUser, setFoundUser] = useState(null);

    const fetchAcademyAdmins = async (academyId) => {
        try {
            const q = query(collection(db, 'users'), where('academyId', '==', academyId), where('role', '==', 'admin'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAcademyAdmins(data);
        } catch (error) {
            console.error("Error fetching admins:", error);
        }
    };

    const handleManageClick = (academy) => {
        setSelectedAcademy(academy);
        fetchAcademyAdmins(academy.id);
        setSearchEmail('');
        setFoundUser(null);
    };

    const handleCloseModal = () => {
        setSelectedAcademy(null);
        setAcademyAdmins([]);
    };

    const handleSearchUser = async (e) => {
        e.preventDefault();
        if (!searchEmail.trim()) return;

        try {
            const formattedSearch = searchEmail.includes('@') ? searchEmail : `${searchEmail}@wordtest.com`;

            const q = query(collection(db, 'users'), where('username', '==', formattedSearch));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const userDoc = snapshot.docs[0];
                setFoundUser({ id: userDoc.id, ...userDoc.data() });
            } else {
                setFoundUser(null);
                alert('사용자를 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error("Error searching user:", error);
            alert('검색 중 오류가 발생했습니다.');
        }
    };

    const handleAssignAdmin = async () => {
        if (!foundUser || !selectedAcademy) return;

        if (!confirm(`${foundUser.name}(${foundUser.username})님을 ${selectedAcademy.name}의 관리자로 지정하시겠습니까?`)) return;

        try {
            await updateDoc(doc(db, 'users', foundUser.id), {
                role: 'admin',
                academyId: selectedAcademy.id
            });
            alert('관리자로 지정되었습니다.');
            setFoundUser(null);
            setSearchEmail('');
            fetchAcademyAdmins(selectedAcademy.id);
        } catch (error) {
            console.error("Error assigning admin:", error);
            alert('관리자 지정 실패');
        }
    };

    const handleRemoveAdmin = async (adminId, adminName) => {
        if (!confirm(`${adminName}님의 관리자 권한을 해제하시겠습니까? (학생으로 변경됩니다)`)) return;

        try {
            await updateDoc(doc(db, 'users', adminId), {
                role: 'student'
            });
            alert('관리자 권한이 해제되었습니다.');
            fetchAcademyAdmins(selectedAcademy.id);
        } catch (error) {
            console.error("Error removing admin:", error);
            alert('권한 해제 실패');
        }
    };

    const [newUser, setNewUser] = useState({
        email: '',
        password: '',
        name: '',
        role: 'student'
    });

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!newUser.email || !newUser.password || !newUser.name) return;
        if (newUser.password.length < 6) {
            alert('비밀번호는 6자 이상이어야 합니다.');
            return;
        }

        if (!confirm(`${newUser.name}님(${newUser.role}) 계정을 생성하시겠습니까?`)) return;

        let secondaryApp = null;
        try {
            const formattedEmail = newUser.email.includes('@') ? newUser.email : `${newUser.email}@wordtest.com`;

            console.log("Starting user creation...");
            const { initializeApp } = await import("firebase/app");
            const { getAuth: getAuthSecondary, createUserWithEmailAndPassword: createAuthUser, signOut: signOutSecondary } = await import("firebase/auth");
            const { firebaseConfig } = await import("../firebase");

            console.log("Initializing secondary app...");
            secondaryApp = initializeApp(firebaseConfig, "secondary");
            const secondaryAuth = getAuthSecondary(secondaryApp);

            console.log("Creating auth user...");
            const userCredential = await createAuthUser(secondaryAuth, formattedEmail, newUser.password);
            const user = userCredential.user;
            console.log("Auth user created:", user.uid);

            console.log("Creating firestore doc...");
            await setDoc(doc(db, 'users', user.uid), {
                username: formattedEmail,
                name: newUser.name,
                role: newUser.role,
                academyId: selectedAcademy.id,
                createdAt: new Date().toISOString(),
                current_word_index: 0,
                words_per_session: 10,
                book_name: '기본',
                study_days: '1,2,3,4,5'
            });
            console.log("Firestore doc created.");

            await signOutSecondary(secondaryAuth);

            alert('계정이 생성되었습니다.');
            setNewUser({ email: '', password: '', name: '', role: 'student' });

            if (newUser.role === 'admin') {
                fetchAcademyAdmins(selectedAcademy.id);
            }

        } catch (error) {
            console.error("Error creating user:", error);
            if (error.code === 'auth/email-already-in-use') {
                alert('이미 사용 중인 이메일입니다.');
            } else if (error.code === 'permission-denied') {
                alert('권한이 없습니다. (Firestore Rules Error)');
            } else {
                alert('계정 생성 실패: ' + error.message);
            }
        } finally {
            if (secondaryApp) {
                const { deleteApp } = await import("firebase/app");
                await deleteApp(secondaryApp);
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="flex items-center justify-between mb-12">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
                            <Globe className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Super Admin</h1>
                            <p className="text-gray-400">전체 학원 통합 관리 시스템</p>
                            {/* Debug Info */}
                            <div className="text-xs text-gray-500 mt-1 flex items-center space-x-2">
                                <span>User: {currentUserEmail}</span>
                                <span>Role: {debugRole || 'Loading...'}</span>
                                {currentUserEmail.includes('stp282') && debugRole !== 'super_admin' && (
                                    <button
                                        onClick={handleForceSuperAdmin}
                                        className="text-indigo-400 hover:text-indigo-300 underline"
                                    >
                                        [Fix Role]
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300"
                    >
                        <LogOut className="w-5 h-5 mr-2" />
                        로그아웃
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Create Academy */}
                    <div className="lg:col-span-1">
                        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 sticky top-8">
                            <h2 className="text-xl font-bold mb-6 flex items-center text-white">
                                <Plus className="w-5 h-5 mr-2 text-indigo-400" />
                                새 학원 생성
                            </h2>
                            <form onSubmit={handleCreateAcademy} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">학원 이름</label>
                                    <input
                                        type="text"
                                        value={newAcademyName}
                                        onChange={(e) => setNewAcademyName(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-white placeholder-gray-600"
                                        placeholder="예: 강남 이스턴 영어"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/20"
                                >
                                    생성하기
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Academy List */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-white flex items-center">
                                    <Building className="w-5 h-5 mr-2 text-indigo-400" />
                                    등록된 학원 목록
                                </h2>
                                <span className="bg-gray-700 px-3 py-1 rounded-full text-sm text-gray-300">
                                    Total: {academies.length}
                                </span>
                            </div>

                            {loading ? (
                                <div className="p-12 text-center text-gray-500">데이터를 불러오는 중...</div>
                            ) : academies.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">등록된 학원이 없습니다.</div>
                            ) : (
                                <div className="divide-y divide-gray-700">
                                    {academies.map((academy) => (
                                        <div key={academy.id} className="p-6 hover:bg-gray-750 transition-colors flex items-center justify-between group">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center text-xl font-bold text-gray-300">
                                                    {academy.name[0]}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-white">{academy.name}</h3>
                                                    <div className="flex items-center space-x-3 text-sm text-gray-400">
                                                        <span>ID: {academy.id}</span>
                                                        <span>•</span>
                                                        <span>{new Date(academy.createdAt).toLocaleDateString()}</span>
                                                        {academy.isDefault && (
                                                            <span className="bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded text-xs">본점</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-3">
                                                <button
                                                    onClick={() => handleManageClick(academy)}
                                                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-sm text-white rounded-lg transition-colors"
                                                >
                                                    관리
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAcademy(academy.id, academy.name)}
                                                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="학원 삭제"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Manage Academy Modal */}
            {selectedAcademy && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-700 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t-2xl">
                            <div>
                                <h2 className="text-xl font-bold text-white">{selectedAcademy.name} 관리</h2>
                                <p className="text-sm text-gray-400 mt-1">ID: {selectedAcademy.id}</p>
                            </div>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-white transition-colors">
                                <span className="text-2xl">×</span>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-8">
                            {/* Create New User */}
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                                    <Plus className="w-5 h-5 mr-2 text-indigo-400" />
                                    신규 계정 생성
                                </h3>
                                <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
                                    <form onSubmit={handleCreateUser} className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                type="text"
                                                required
                                                placeholder="아이디 (또는 이메일)"
                                                value={newUser.email}
                                                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-white text-sm"
                                            />
                                            <input
                                                type="text"
                                                required
                                                placeholder="이름"
                                                value={newUser.name}
                                                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-white text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                type="password"
                                                required
                                                placeholder="비밀번호 (6자 이상)"
                                                value={newUser.password}
                                                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-white text-sm"
                                            />
                                            <select
                                                value={newUser.role}
                                                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-white text-sm"
                                            >
                                                <option value="student">학생</option>
                                                <option value="admin">학원 관리자</option>
                                            </select>
                                        </div>
                                        <button
                                            type="submit"
                                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-colors"
                                        >
                                            계정 생성
                                        </button>
                                    </form>
                                </div>
                            </div>

                            {/* Admin List */}
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                                    <Users className="w-5 h-5 mr-2 text-indigo-400" />
                                    관리자 목록
                                </h3>
                                <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                                    {academyAdmins.length === 0 ? (
                                        <p className="p-4 text-center text-gray-500 text-sm">지정된 관리자가 없습니다.</p>
                                    ) : (
                                        <div className="divide-y divide-gray-800">
                                            {academyAdmins.map(admin => (
                                                <div key={admin.id} className="p-4 flex items-center justify-between">
                                                    <div>
                                                        <p className="font-bold text-gray-200">{admin.name}</p>
                                                        <p className="text-sm text-gray-500">{admin.username}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveAdmin(admin.id, admin.name)}
                                                        className="text-xs text-red-400 hover:text-red-300 hover:underline"
                                                    >
                                                        권한 해제
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Add Admin (Existing User) */}
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                                    <Plus className="w-5 h-5 mr-2 text-indigo-400" />
                                    기존 사용자 관리자 지정
                                </h3>
                                <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
                                    <form onSubmit={handleSearchUser} className="flex gap-2 mb-4">
                                        <input
                                            type="text"
                                            value={searchEmail}
                                            onChange={(e) => setSearchEmail(e.target.value)}
                                            placeholder="사용자 아이디 (또는 이메일) 검색"
                                            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-white text-sm"
                                        />
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold transition-colors"
                                        >
                                            검색
                                        </button>
                                    </form>

                                    {foundUser && (
                                        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-between animate-fade-in">
                                            <div>
                                                <p className="font-bold text-gray-200">{foundUser.name}</p>
                                                <p className="text-sm text-gray-500">{foundUser.username}</p>
                                                <p className="text-xs text-indigo-400 mt-1">현재 역할: {foundUser.role}</p>
                                            </div>
                                            <button
                                                onClick={handleAssignAdmin}
                                                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-bold transition-colors"
                                            >
                                                관리자 지정
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-700 bg-gray-800 rounded-b-2xl flex justify-end">
                            <button
                                onClick={handleCloseModal}
                                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

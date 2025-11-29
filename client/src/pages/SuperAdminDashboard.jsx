import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth, firebaseConfig } from '../firebase';
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, where, setDoc, getDoc, writeBatch, increment } from 'firebase/firestore';
import { Building, Plus, Users, LogOut, Globe, Trash2, Database, Download, Upload, AlertTriangle } from 'lucide-react';


export default function SuperAdminDashboard() {
    const [academies, setAcademies] = useState([]);
    const [newAcademyName, setNewAcademyName] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Debugging state
    const [debugRole, setDebugRole] = useState(null);
    const [currentUserEmail, setCurrentUserEmail] = useState('');

    // Tab state
    const [activeTab, setActiveTab] = useState('academies'); // 'academies', 'admins', or 'monthly'

    // Billing State
    const [showBillingModal, setShowBillingModal] = useState(null);
    const [billingSettings, setBillingSettings] = useState({ billingType: 'per_student', pricePerStudent: 0, flatRateAmount: 0 });

    // Monthly Stats State
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [monthlyStats, setMonthlyStats] = useState({});
    const [monthlyLoading, setMonthlyLoading] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(null);

    // Admin Management State
    const [allAdmins, setAllAdmins] = useState([]);
    const [adminsLoading, setAdminsLoading] = useState(false);

    // Data Management State
    const [targetAcademyId, setTargetAcademyId] = useState('');
    const [dataLoading, setDataLoading] = useState(false);

    const handleBackup = async () => {
        if (!targetAcademyId) {
            alert('백업할 학원을 선택해주세요.');
            return;
        }

        if (!window.confirm('데이터 백업을 시작하시겠습니까?')) return;

        setDataLoading(true);
        try {
            const collections = ['users', 'classes', 'words', 'test_results'];
            const backupData = {
                metadata: {
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    academyId: targetAcademyId,
                    exportedBy: auth.currentUser.email
                },
                data: {}
            };

            for (const colName of collections) {
                let q;
                if (colName === 'test_results') {
                    const userQ = query(collection(db, 'users'), where('academyId', '==', targetAcademyId));
                    const userSnap = await getDocs(userQ);
                    const userIds = userSnap.docs.map(d => d.id);

                    if (userIds.length > 0) {
                        const allResultsSnap = await getDocs(collection(db, 'test_results'));
                        backupData.data[colName] = allResultsSnap.docs
                            .map(d => ({ id: d.id, ...d.data() }))
                            .filter(r => userIds.includes(r.user_id));
                    } else {
                        backupData.data[colName] = [];
                    }
                } else {
                    q = query(collection(db, colName), where('academyId', '==', targetAcademyId));
                    const snapshot = await getDocs(q);
                    backupData.data[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            }

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${targetAcademyId}_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert('백업이 완료되었습니다.');
        } catch (err) {
            console.error("Backup failed:", err);
            alert('백업 실패: ' + err.message);
        } finally {
            setDataLoading(false);
        }
    };

    const handleRestore = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!targetAcademyId) {
            alert('복원할 대상 학원을 선택해주세요.');
            e.target.value = '';
            return;
        }

        if (!window.confirm('데이터를 복원하시겠습니까?\n기존 데이터와 병합되거나 덮어씌워질 수 있습니다.')) {
            e.target.value = '';
            return;
        }

        setDataLoading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target.result);

                if (!json.metadata || !json.data) {
                    throw new Error('올바르지 않은 백업 파일 형식입니다.');
                }

                const batchSize = 500;
                let operationCount = 0;

                for (const [colName, items] of Object.entries(json.data)) {
                    const chunks = [];
                    for (let i = 0; i < items.length; i += batchSize) {
                        chunks.push(items.slice(i, i + batchSize));
                    }

                    for (const chunk of chunks) {
                        const batch = writeBatch(db);
                        chunk.forEach(item => {
                            const docRef = doc(db, colName, item.id);
                            const data = { ...item };

                            if (colName !== 'test_results') {
                                data.academyId = targetAcademyId;
                            }

                            delete data.id;

                            batch.set(docRef, data, { merge: true });
                            operationCount++;
                        });
                        await batch.commit();
                    }
                }

                alert(`복원이 완료되었습니다. (총 ${operationCount}개 항목 처리)`);
            } catch (err) {
                console.error("Restore failed:", err);
                alert('복원 실패: ' + err.message);
            } finally {
                setDataLoading(false);
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    useEffect(() => {
        fetchAcademies();

        const unsubscribe = auth.onAuthStateChanged(async user => {
            if (user) {
                setCurrentUserEmail(user.email);
                checkMyRole(user.uid);
                checkMyRole(user.uid);
                if (activeTab === 'monthly') {
                    fetchMonthlyStats(user, selectedMonth);
                }
            } else {
                setCurrentUserEmail('');
                setDebugRole(null);
                setMonthlyStats({});
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (activeTab === 'admins') {
            fetchAllAdmins();
        } else if (activeTab === 'monthly' && auth.currentUser) {
            fetchMonthlyStats(auth.currentUser, selectedMonth);
        }
    }, [activeTab, academies, selectedMonth]);

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

    const fetchAllAdmins = async () => {
        setAdminsLoading(true);
        try {
            const q = query(collection(db, 'users'), where('role', 'in', ['admin', 'super_admin']));
            const snapshot = await getDocs(q);
            const adminsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Enrich with academy names
            const enrichedAdmins = adminsData.map(admin => {
                const academy = academies.find(a => a.id === admin.academyId);
                return {
                    ...admin,
                    academyName: academy ? academy.name : '미지정'
                };
            });

            setAllAdmins(enrichedAdmins);
        } catch (error) {
            console.error("Error fetching all admins:", error);
        } finally {
            setAdminsLoading(false);
        }
    };



    const fetchMonthlyStats = async (user, monthStr) => {
        setMonthlyLoading(true);
        try {
            const [year, month] = monthStr.split('-');
            const token = await user.getIdToken();
            const response = await fetch(`/api/billing/monthly-stats?year=${year}&month=${month}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setMonthlyStats(data);
            }
        } catch (error) {
            console.error("Error fetching monthly stats:", error);
        } finally {
            setMonthlyLoading(false);
        }
    };

    const handleOpenBillingModal = async (academy) => {
        setShowBillingModal(academy);
        try {
            const docRef = doc(db, 'franchise_settings', academy.id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBillingSettings({
                    billingType: data.billing_type || 'per_student',
                    pricePerStudent: data.price_per_student || 0,
                    flatRateAmount: data.flat_rate_amount || 0
                });
            } else {
                setBillingSettings({ billingType: 'per_student', pricePerStudent: 0, flatRateAmount: 0 });
            }
        } catch (e) {
            console.error("Error fetching settings:", e);
        }
    };

    const handleSaveBillingSettings = async () => {
        if (!showBillingModal) return;

        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch('/api/billing/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    academyId: showBillingModal.id,
                    ...billingSettings
                })
            });

            if (!response.ok) throw new Error('Failed to update settings');

            alert('과금 설정이 저장되었습니다.');
            setShowBillingModal(null);
        } catch (error) {
            console.error("Error saving billing settings:", error);
            alert('저장 실패');
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
        if (!confirm(`정말 '${name}' 학원을 삭제하시겠습니까?\\n소속된 모든 데이터(학생, 단어 등)는 유지되지만 접근이 불가능해질 수 있습니다.`)) return;

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
        if (!confirm(`${adminName}님을 이 학원의 관리자 목록에서 제거하시겠습니까? (역할은 유지되며, 학원 연결만 해제됩니다)`)) return;

        try {
            await updateDoc(doc(db, 'users', adminId), {
                academyId: null  // Remove academy association instead of changing role
            });
            alert('학원 연결이 해제되었습니다.');
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
        const appName = `secondary_${Date.now()}`;

        try {
            const formattedEmail = newUser.email.includes('@') ? newUser.email : `${newUser.email}@wordtest.com`;

            // Initialize secondary app with unique name
            secondaryApp = initializeApp(firebaseConfig, appName);
            const secondaryAuth = getAuth(secondaryApp);

            // Create user in Auth
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formattedEmail, newUser.password);
            const user = userCredential.user;

            // Prepare user data
            const userData = {
                username: formattedEmail,
                name: newUser.name,
                role: newUser.role,
                academyId: selectedAcademy.id,
                createdAt: new Date().toISOString(),
            };

            // Add student-specific fields only if role is student
            if (newUser.role === 'student') {
                Object.assign(userData, {
                    current_word_index: 0,
                    words_per_session: 10,
                    book_name: '기본',
                    study_days: '1,2,3,4,5'
                });
            }

            // Create user in Firestore (using primary db connection)
            await setDoc(doc(db, 'users', user.uid), userData);

            // Increment activeStudents counter for the academy
            if (newUser.role === 'student' && selectedAcademy.id) {
                await updateDoc(doc(db, 'academies', selectedAcademy.id), {
                    activeStudents: increment(1)
                });
                // Refresh academies to show updated count
                fetchAcademies();
            }

            // Sign out from secondary app
            await signOut(secondaryAuth);

            alert('계정이 생성되었습니다.');
            setNewUser({ email: '', password: '', name: '', role: 'student' });

            if (newUser.role === 'admin') {
                fetchAcademyAdmins(selectedAcademy.id);
            }

        } catch (error) {
            console.error("Error creating user:", error);
            if (error.code === 'auth/email-already-in-use') {
                alert('이미 사용 중인 이메일입니다.');
            } else {
                alert('계정 생성 실패: ' + error.message);
            }
        } finally {
            if (secondaryApp) {
                try {
                    await deleteApp(secondaryApp);
                } catch (e) {
                    console.error("Error deleting secondary app:", e);
                }
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

                {/* Tabs */}
                <div className="flex space-x-4 mb-8 border-b border-gray-700">
                    <button
                        onClick={() => setActiveTab('academies')}
                        className={`pb-3 px-4 font-medium transition-colors relative ${activeTab === 'academies' ? 'text-indigo-400' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                        학원 관리
                        {activeTab === 'academies' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('admins')}
                        className={`pb-3 px-4 font-medium transition-colors relative ${activeTab === 'admins' ? 'text-purple-400' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                        관리자 관리
                        {activeTab === 'admins' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-500 rounded-t-full"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('monthly')}
                        className={`pb-3 px-4 font-medium transition-colors relative ${activeTab === 'monthly' ? 'text-green-400' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                        월별 정산 관리
                        {activeTab === 'monthly' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-500 rounded-t-full"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`pb-3 px-4 font-medium transition-colors relative ${activeTab === 'data' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                        데이터 관리
                        {activeTab === 'data' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-t-full"></div>}
                    </button>
                </div>

                {activeTab === 'academies' ? (
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
                                        {academies.map((academy) => {
                                            return (
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
                                                            <div className="mt-2 flex space-x-4 text-xs">
                                                                <span className="text-green-400">Active: {academy.activeStudents || 0}명</span>
                                                                <span className="text-gray-500">Suspended: {academy.suspendedStudents || 0}명</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-3">
                                                        <button
                                                            onClick={() => handleOpenBillingModal(academy)}
                                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-sm text-white rounded-lg transition-colors"
                                                        >
                                                            과금 설정
                                                        </button>
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
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'admins' ? (
                    /* Admin Management View */
                    <div className="space-y-6">
                        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-white flex items-center">
                                    <Users className="w-5 h-5 mr-2 text-purple-400" />
                                    전체 관리자 목록
                                </h2>
                                <span className="bg-gray-700 px-3 py-1 rounded-full text-sm text-gray-300">
                                    Total: {allAdmins.length}
                                </span>
                            </div>

                            {adminsLoading ? (
                                <div className="p-12 text-center text-gray-500">데이터를 불러오는 중...</div>
                            ) : allAdmins.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">등록된 관리자가 없습니다.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-900/50 border-b border-gray-700 text-gray-400 text-sm uppercase tracking-wider">
                                                <th className="p-4 font-medium">이름</th>
                                                <th className="p-4 font-medium">아이디</th>
                                                <th className="p-4 font-medium text-center">역할</th>
                                                <th className="p-4 font-medium text-center">소속 학원</th>
                                                <th className="p-4 font-medium text-center">생성일</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-700">
                                            {allAdmins.map((admin) => (
                                                <tr key={admin.id} className="hover:bg-gray-750 transition-colors">
                                                    <td className="p-4 text-white font-medium">{admin.name}</td>
                                                    <td className="p-4 text-gray-400 text-sm">{admin.username}</td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${admin.role === 'super_admin' ? 'bg-red-900/30 text-red-400' : 'bg-purple-900/30 text-purple-400'}`}>
                                                            {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center text-gray-300">{admin.academyName}</td>
                                                    <td className="p-4 text-center text-gray-400 text-sm">
                                                        {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                ) : activeTab === 'data' ? (
                    /* Data Management View */
                    <div className="space-y-6">
                        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                                <Database className="w-5 h-5 mr-2 text-blue-400" />
                                데이터 백업 및 복원
                            </h2>

                            {/* Target Selection */}
                            <div className="mb-8">
                                <label className="block text-sm font-medium text-gray-400 mb-2">대상 학원 선택</label>
                                <select
                                    value={targetAcademyId}
                                    onChange={(e) => setTargetAcademyId(e.target.value)}
                                    className="w-full md:w-1/2 px-4 py-3 bg-gray-900 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-white"
                                >
                                    <option value="">학원을 선택하세요</option>
                                    {academies.map(academy => (
                                        <option key={academy.id} value={academy.id}>
                                            {academy.name} ({academy.id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Backup */}
                                <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-blue-900/30 text-blue-400 rounded-lg">
                                            <Download className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-2 py-1 rounded">EXPORT</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">데이터 백업</h3>
                                    <p className="text-sm text-gray-400 mb-6">
                                        선택한 학원의 모든 데이터를 JSON 파일로 다운로드합니다.
                                    </p>
                                    <button
                                        onClick={handleBackup}
                                        disabled={dataLoading || !targetAcademyId}
                                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-bold transition-colors flex items-center justify-center"
                                    >
                                        {dataLoading ? '처리 중...' : '백업 파일 다운로드'}
                                    </button>
                                </div>

                                {/* Restore */}
                                <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-green-900/30 text-green-400 rounded-lg">
                                            <Upload className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-bold text-green-400 bg-green-900/30 px-2 py-1 rounded">IMPORT</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">데이터 복원</h3>
                                    <p className="text-sm text-gray-400 mb-6">
                                        백업 파일을 업로드하여 데이터를 복원합니다. (기존 데이터와 병합)
                                    </p>

                                    <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-900/50 rounded-lg flex items-start">
                                        <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 text-yellow-500 flex-shrink-0" />
                                        <p className="text-xs text-yellow-200">
                                            주의: 복원 시 선택한 학원의 데이터로 강제 변환되어 저장됩니다.
                                        </p>
                                    </div>

                                    <label className={`w-full py-3 ${dataLoading || !targetAcademyId ? 'bg-gray-700 cursor-not-allowed text-gray-500' : 'bg-green-600 hover:bg-green-500 cursor-pointer text-white'} rounded-xl font-bold transition-colors flex items-center justify-center`}>
                                        {dataLoading ? '처리 중...' : '백업 파일 업로드'}
                                        <input
                                            type="file"
                                            accept=".json"
                                            onChange={handleRestore}
                                            disabled={dataLoading || !targetAcademyId}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Monthly Stats View */
                    <div className="space-y-6">
                        <div className="flex items-center justify-between bg-gray-800 p-6 rounded-2xl border border-gray-700">
                            <h2 className="text-xl font-bold text-white">월별 정산 현황</h2>
                            <div className="flex items-center space-x-4">
                                <label className="text-gray-400 text-sm">조회 월 선택:</label>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                            {monthlyLoading ? (
                                <div className="p-12 text-center text-gray-500">데이터를 계산 중입니다...</div>
                            ) : Object.keys(monthlyStats).length === 0 ? (
                                <div className="p-12 text-center text-gray-500">데이터가 없습니다.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-900/50 border-b border-gray-700 text-gray-400 text-sm uppercase tracking-wider">
                                                <th className="p-4 font-medium">학원명 (ID)</th>
                                                <th className="p-4 font-medium text-center">전체 학생</th>
                                                <th className="p-4 font-medium text-center">과금 대상 (≥7일)</th>
                                                <th className="p-4 font-medium text-right">예상 청구액</th>
                                                <th className="p-4 font-medium text-center">상세보기</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-700">
                                            {Object.values(monthlyStats).map((stat) => {
                                                const academyName = academies.find(a => a.id === stat.name)?.name || stat.name;
                                                return (
                                                    <tr key={stat.name} className="hover:bg-gray-750 transition-colors">
                                                        <td className="p-4">
                                                            <div className="font-bold text-white">{academyName}</div>
                                                            <div className="text-xs text-gray-500">{stat.name}</div>
                                                        </td>
                                                        <td className="p-4 text-center text-gray-300">{stat.totalStudents}명</td>
                                                        <td className="p-4 text-center">
                                                            <span className="bg-green-900/50 text-green-400 px-2 py-1 rounded-lg text-sm font-bold">
                                                                {stat.billableStudents}명
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right font-bold text-indigo-400">
                                                            {stat.totalCost.toLocaleString()}원
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <button
                                                                onClick={() => setShowDetailModal(stat)}
                                                                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-sm text-white rounded-lg transition-colors"
                                                            >
                                                                조회
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Manage Academy Modal */}
            {
                selectedAcademy && (
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
                )
            }

            {/* Billing Settings Modal */}
            {
                showBillingModal && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
                            <div className="p-6 border-b border-gray-700">
                                <h2 className="text-xl font-bold text-white">{showBillingModal.name} 과금 설정</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">과금 방식</label>
                                    <select
                                        value={billingSettings.billingType}
                                        onChange={(e) => setBillingSettings({ ...billingSettings, billingType: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="per_student">학생당 과금</option>
                                        <option value="flat_rate">정액제</option>
                                    </select>
                                </div>
                                {billingSettings.billingType === 'per_student' ? (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">학생당 금액 (원)</label>
                                        <input
                                            type="number"
                                            value={billingSettings.pricePerStudent}
                                            onChange={(e) => setBillingSettings({ ...billingSettings, pricePerStudent: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">정액 금액 (원)</label>
                                        <input
                                            type="number"
                                            value={billingSettings.flatRateAmount}
                                            onChange={(e) => setBillingSettings({ ...billingSettings, flatRateAmount: parseInt(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-gray-700 flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowBillingModal(null)}
                                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleSaveBillingSettings}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors font-bold"
                                >
                                    저장
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Monthly Detail Modal */}
            {
                showDetailModal && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-700 flex flex-col max-h-[90vh]">
                            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        {academies.find(a => a.id === showDetailModal.name)?.name || showDetailModal.name} 상세 내역
                                    </h2>
                                    <p className="text-sm text-gray-400 mt-1">{selectedMonth}월</p>
                                </div>
                                <button onClick={() => setShowDetailModal(null)} className="text-gray-400 hover:text-white transition-colors">
                                    <span className="text-2xl">×</span>
                                </button>
                            </div>
                            <div className="overflow-y-auto flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-gray-800 z-10">
                                        <tr className="border-b border-gray-700 text-gray-400 text-sm uppercase tracking-wider">
                                            <th className="p-4 font-medium">이름</th>
                                            <th className="p-4 font-medium">아이디</th>
                                            <th className="p-4 font-medium text-center">활성 일수</th>
                                            <th className="p-4 font-medium text-center">현재 상태</th>
                                            <th className="p-4 font-medium text-center">과금 여부</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {showDetailModal.students.map((student) => (
                                            <tr key={student.id} className="hover:bg-gray-750 transition-colors">
                                                <td className="p-4 text-white font-medium">{student.name}</td>
                                                <td className="p-4 text-gray-400 text-sm">{student.username}</td>
                                                <td className="p-4 text-center text-white">{student.activeDays}일</td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${student.currentStatus === 'suspended' ? 'bg-gray-700 text-gray-400' : 'bg-green-900/30 text-green-400'}`}>
                                                        {student.currentStatus === 'suspended' ? 'Suspended' : 'Active'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {student.isBillable ? (
                                                        <span className="text-indigo-400 font-bold">O</span>
                                                    ) : (
                                                        <span className="text-gray-600">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 border-t border-gray-700 flex justify-end">
                                <button
                                    onClick={() => setShowDetailModal(null)}
                                    className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, Calendar, X, Activity, FileText } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, updateDoc, deleteDoc, doc, setDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

// Need config to create a secondary app for creating users without logging out admin
const firebaseConfig = {
    apiKey: "AIzaSyCW4NbNdOkfs-lPSNFDyNqRTCPYimL7rks",
    authDomain: "eastern-wordtest.firebaseapp.com",
    projectId: "eastern-wordtest",
    storageBucket: "eastern-wordtest.firebasestorage.app",
    messagingSenderId: "908358368350",
    appId: "1:908358368350:web:18a2197cf035fb118088cf",
    measurementId: "G-WHCV2L49WK"
};

export default function StudentManagement() {
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [newStudent, setNewStudent] = useState({ username: '', password: '', name: '' });
    const [editingStudent, setEditingStudent] = useState(null);
    const [showAbsenceModal, setShowAbsenceModal] = useState(null);
    const [absenceDate, setAbsenceDate] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [statusLogs, setStatusLogs] = useState([]);
    const [showDetailModal, setShowDetailModal] = useState(false);

    const fetchStudents = useCallback(async () => {
        try {
            const academyId = localStorage.getItem('academyId') || 'academy_default';
            // Filter students by academyId
            const q = query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('academyId', '==', academyId)
            );
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStudents(data);
        } catch (err) {
            console.error("Error fetching students:", err);
        }
    }, []);

    const fetchClasses = useCallback(async () => {
        try {
            const academyId = localStorage.getItem('academyId') || 'academy_default';
            // Filter classes by academyId
            const q = query(collection(db, 'classes'), where('academyId', '==', academyId));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasses(data);
        } catch (err) {
            console.error("Error fetching classes:", err);
        }
    }, []);

    useEffect(() => {
        fetchStudents();
        fetchClasses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleMarkAbsent = async () => {
        if (!absenceDate) {
            alert('날짜를 선택해주세요');
            return;
        }
        // In a real app, you'd implement complex date shifting logic here or via Cloud Functions.
        // For this serverless migration, we'll just alert.
        alert("공강 처리 기능은 현재 서버리스 버전에서 지원되지 않습니다. (추후 업데이트 예정)");
        setShowAbsenceModal(null);
    };

    const handleUpdateClass = async (studentId, classId) => {
        try {
            const studentRef = doc(db, 'users', studentId);
            await updateDoc(studentRef, {
                class_id: classId || null,
                class_name: classes.find(c => c.id === classId)?.name || null
            });

            setStudents(students.map(s =>
                s.id === studentId
                    ? { ...s, class_id: classId, class_name: classes.find(c => c.id === classId)?.name }
                    : s
            ));
        } catch (err) {
            console.error(err);
            alert('반 배정 실패');
        }
    };

    const handleRegisterStudent = async (e) => {
        e.preventDefault();
        if (!newStudent.username || !newStudent.password) {
            alert('아이디와 비밀번호를 입력해주세요.');
            return;
        }

        try {
            // Create a secondary app to create user without logging out Admin
            const secondaryApp = initializeApp(firebaseConfig, "Secondary");
            const secondaryAuth = getAuth(secondaryApp);

            const email = newStudent.username.includes('@') ? newStudent.username : `${newStudent.username}@wordtest.com`;
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, newStudent.password);
            const user = userCredential.user;
            const academyId = localStorage.getItem('academyId') || 'academy_default';

            await setDoc(doc(db, 'users', user.uid), {
                username: newStudent.username,
                name: newStudent.name,
                role: 'student',
                created_at: new Date().toISOString(),
                book_name: '기본',
                study_days: '1,2,3,4,5',
                words_per_session: 10,
                current_word_index: 0,
                academyId // Add academyId
            });

            alert('학생이 등록되었습니다!');
            setNewStudent({ username: '', password: '', name: '' });
            fetchStudents();

            // Clean up secondary app (optional, but good practice if supported, though deleteApp is async)
            // deleteApp(secondaryApp); 
        } catch (err) {
            console.error("Registration error:", err);
            alert('등록 실패: ' + err.message);
        }
    };
    const handleUpdateSettings = async (student) => {
        try {
            const studentRef = doc(db, 'users', student.id);
            const updates = {
                book_name: student.book_name,
                active_books: student.active_books || [student.book_name],
                next_books: student.next_books || [],
                study_days: student.study_days,
                words_per_session: student.words_per_session,
                words_per_day: student.words_per_day || {},
                current_word_index: student.current_word_index,
                name: student.name,
                book_settings: student.book_settings || {},
                book_progress: student.book_progress || {}
            };

            // Note: Password update in Auth is not handled here due to client SDK limitations.
            // We could update a 'password_hint' field in Firestore if really needed, but better to skip.

            await updateDoc(studentRef, updates);

            alert('설정이 업데이트되었습니다!');
            setEditingStudent(null);
            fetchStudents();
        } catch (err) {
            alert('업데이트 실패: ' + err.message);
        }
    };

    const handleDeleteStudent = async (userId) => {
        if (!confirm('이 학생을 삭제하시겠습니까? (복구 불가)')) return;

        try {
            await deleteDoc(doc(db, 'users', userId));
            // Note: Auth user is not deleted here. They just lose access to data.
            // To delete Auth user, Cloud Functions are best.

            alert('학생 데이터가 삭제되었습니다.');
            fetchStudents();
        } catch (err) {
            alert('삭제 실패: ' + err.message);
        }
    };

    const handleResetPassword = async (studentId) => {
        const newPassword = prompt('새로운 비밀번호를 입력하세요 (최소 6자):');
        if (!newPassword) return;
        if (newPassword.length < 6) {
            alert('비밀번호는 최소 6자 이상이어야 합니다.');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ uid: studentId, newPassword })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to reset password');
            }

            alert('비밀번호가 성공적으로 변경되었습니다.');
        } catch (err) {
            console.error(err);
            alert('비밀번호 변경 실패: ' + err.message);
        }
    };

    const [selectedClass, setSelectedClass] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all'); // 'all', 'active', 'suspended'

    const filteredStudents = students.filter(s => {
        const classMatch = selectedClass === 'all' || s.class_id === selectedClass;
        const statusMatch = selectedStatus === 'all' || (selectedStatus === 'active' ? (s.status !== 'suspended') : (s.status === 'suspended'));
        return classMatch && statusMatch;
    });

    const fetchStatusLogs = async (studentId) => {
        try {
            let rawStatusLogs = [];
            try {
                const statusQ = query(
                    collection(db, 'student_status_logs'),
                    where('student_id', '==', studentId),
                    orderBy('changed_at', 'desc'),
                    limit(50)
                );
                const statusSnapshot = await getDocs(statusQ);
                rawStatusLogs = statusSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (queryError) {
                console.warn("Status logs index query failed, falling back to client-side sorting:", queryError);
                const fallbackQuery = query(
                    collection(db, 'student_status_logs'),
                    where('student_id', '==', studentId)
                );
                const fallbackSnapshot = await getDocs(fallbackQuery);
                rawStatusLogs = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                rawStatusLogs.sort((a, b) => {
                    const dateA = a.changed_at?.toDate ? a.changed_at.toDate() : new Date(a.changed_at);
                    const dateB = b.changed_at?.toDate ? b.changed_at.toDate() : new Date(b.changed_at);
                    return dateB - dateA;
                });
                rawStatusLogs = rawStatusLogs.slice(0, 50);
            }
            setStatusLogs(rawStatusLogs);
        } catch (e) {
            console.error("Error fetching status logs:", e);
            setStatusLogs([]);
        }
    };

    const handleViewDetails = async (student) => {
        setSelectedStudent(student);
        await fetchStatusLogs(student.id);
        setShowDetailModal(true);
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '-';
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleToggleStatus = async (student) => {
        const newStatus = student.status === 'suspended' ? 'active' : 'suspended';
        if (!confirm(`${student.name} 학생을 ${newStatus === 'active' ? '정상' : '휴원'} 상태로 변경하시겠습니까?`)) return;

        try {
            const token = localStorage.getItem('token');
            const academyId = localStorage.getItem('academyId') || 'academy_default';

            const response = await fetch('/api/student/status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    studentId: student.id,
                    status: newStatus,
                    academyId: academyId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update status');
            }

            setStudents(students.map(s =>
                s.id === student.id ? { ...s, status: newStatus } : s
            ));

            // Auto-switch filter to 'all' so user can see the result
            setSelectedStatus('all');

            alert(`상태가 ${newStatus === 'active' ? '정상' : '휴원'}으로 변경되었습니다.\n필터가 '전체 상태'로 변경되었습니다.`);
        } catch (err) {
            console.error(err);
            alert('상태 변경 실패: ' + err.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-3 bg-indigo-600 rounded-lg">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">학생 관리</h1>
                    </div>
                </header>

                {/* Student Registration */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4 flex items-center">
                        <UserPlus className="w-5 h-5 mr-2 text-gray-500" />
                        학생 등록
                    </h2>
                    <form onSubmit={handleRegisterStudent} className="flex gap-4">
                        <input
                            type="text"
                            placeholder="학생 아이디"
                            value={newStudent.username}
                            onChange={(e) => setNewStudent({ ...newStudent, username: e.target.value })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <input
                            type="text"
                            placeholder="학생 이름"
                            value={newStudent.name}
                            onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <input
                            type="password"
                            placeholder="비밀번호"
                            value={newStudent.password}
                            onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button
                            type="submit"
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all flex items-center space-x-2"
                        >
                            <UserPlus className="w-5 h-5" />
                            <span>등록</span>
                        </button>
                    </form>
                </div>

                {/* Student List */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">학생 목록 ({filteredStudents.length}명)</h2>
                        <div className="flex space-x-2">
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="all">전체 상태</option>
                                <option value="active">정상</option>
                                <option value="suspended">휴원</option>
                            </select>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="all">전체 반</option>
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {filteredStudents.map((student) => (
                            <div key={student.id} className={`border rounded-lg p-4 ${student.status === 'suspended' ? 'bg-gray-50 border-gray-200' : 'border-gray-200'}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <h3 className="font-semibold text-gray-900">{student.name || student.username}</h3>
                                            {student.status === 'suspended' && (
                                                <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">휴원</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500">ID: {student.username}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => handleToggleStatus(student)}
                                            className={`px-3 py-1 text-sm rounded flex items-center space-x-1 ${student.status === 'suspended'
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            <span>{student.status === 'suspended' ? '복원' : '휴원'}</span>
                                        </button>
                                        <button
                                            onClick={() => setShowAbsenceModal(student.id)}
                                            className="px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 flex items-center space-x-1"
                                        >
                                            <Calendar className="w-4 h-4" />
                                            <span>공강 처리</span>
                                        </button>
                                        {editingStudent === student.id ? (
                                            <>
                                                <button
                                                    onClick={() => handleUpdateSettings(student)}
                                                    className="px-4 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                                >
                                                    저장
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingStudent(null);
                                                        fetchStudents();
                                                    }}
                                                    className="px-4 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500"
                                                >
                                                    취소
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleViewDetails(student)}
                                                    className="px-4 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                                                >
                                                    상세
                                                </button>
                                                <button
                                                    onClick={() => setEditingStudent(student.id)}
                                                    className="px-4 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                                >
                                                    수정
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteStudent(student.id)}
                                                    className="px-4 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                                                >
                                                    삭제
                                                </button>
                                                <button
                                                    onClick={() => handleResetPassword(student.id)}
                                                    className="px-4 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600"
                                                >
                                                    비밀번호 초기화
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Name (Edit Mode) */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                                        {editingStudent === student.id ? (
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    value={student.name || ''}
                                                    onChange={(e) => setStudents(students.map(s =>
                                                        s.id === student.id ? { ...s, name: e.target.value } : s
                                                    ))}
                                                    placeholder="이름"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-gray-600 py-2 text-sm">
                                                {student.name}
                                            </p>
                                        )}
                                    </div>

                                    {/* Class Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">반 배정</label>
                                        {editingStudent === student.id ? (
                                            <select
                                                value={student.class_id || ''}
                                                onChange={(e) => handleUpdateClass(student.id, e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            >
                                                <option value="">반 선택 안함</option>
                                                {classes.map(cls => (
                                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <p className="text-gray-600 py-2">{student.class_name || '미배정'}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400 text-center">
                                    상세 학습 설정은 '수업 관리' 메뉴를 이용해주세요.
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Absence Modal */}
                {
                    showAbsenceModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold">공강 처리</h3>
                                    <button onClick={() => setShowAbsenceModal(null)} className="text-gray-400 hover:text-gray-600">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="text-sm text-gray-600 mb-4">
                                    공강 처리하면 해당 날짜의 학습이 자동으로 뒤로 밀립니다.
                                </p>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">공강 날짜</label>
                                    <input
                                        type="date"
                                        value={absenceDate}
                                        onChange={(e) => setAbsenceDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => handleMarkAbsent(showAbsenceModal)}
                                        className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                                    >
                                        공강 처리
                                    </button>
                                    <button
                                        onClick={() => setShowAbsenceModal(null)}
                                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                    >
                                        취소
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Student Detail Modal */}
                {showDetailModal && selectedStudent && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">{selectedStudent.name || selectedStudent.username} 학생 정보</h2>
                                    <p className="text-sm text-gray-500 mt-1">ID: {selectedStudent.username}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        setSelectedStudent(null);
                                        setStatusLogs([]);
                                    }}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Basic Info */}
                                <section className="bg-gray-50 rounded-xl p-4">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                                        기본 정보
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-500">이름:</span>
                                            <span className="ml-2 font-medium text-gray-900">{selectedStudent.name || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">아이디:</span>
                                            <span className="ml-2 font-medium text-gray-900">{selectedStudent.username}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">반:</span>
                                            <span className="ml-2 font-medium text-gray-900">{selectedStudent.class_name || '미배정'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">상태:</span>
                                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${selectedStudent.status === 'suspended'
                                                    ? 'bg-gray-200 text-gray-700'
                                                    : 'bg-green-100 text-green-700'
                                                }`}>
                                                {selectedStudent.status === 'suspended' ? '휴원' : '정상'}
                                            </span>
                                        </div>
                                    </div>
                                </section>

                                {/* Study Progress */}
                                <section className="bg-blue-50 rounded-xl p-4">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 학습 진도</h3>
                                    <div className="space-y-2 text-sm">
                                        {selectedStudent.book_progress && Object.keys(selectedStudent.book_progress).length > 0 ? (
                                            Object.entries(selectedStudent.book_progress).map(([book, progress]) => (
                                                <div key={book} className="flex justify-between">
                                                    <span className="text-gray-700">{book}:</span>
                                                    <span className="font-medium text-gray-900">{progress} 단어</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-gray-500">학습 진도 없음</p>
                                        )}
                                    </div>
                                </section>

                                {/* Dollar Balance */}
                                <section className="bg-green-50 rounded-xl p-4">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 달러 잔액</h3>
                                    <p className="text-2xl font-bold text-green-600">
                                        {selectedStudent.dollars?.toFixed(2) || '0.00'} $
                                    </p>
                                </section>

                                {/* Status Change History */}
                                <section>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <Activity className="w-5 h-5 mr-2 text-blue-600" />
                                        상태 변경 이력
                                    </h3>
                                    {statusLogs.length === 0 ? (
                                        <p className="text-gray-500 text-center py-8 bg-gray-50 rounded-lg">상태 변경 이력이 없습니다.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {statusLogs.map((log, index) => (
                                                <div
                                                    key={log.id || index}
                                                    className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 hover:shadow-md transition-shadow"
                                                >
                                                    <div className="flex items-center space-x-4">
                                                        <div className={`p-3 rounded-full ${log.status === 'active'
                                                                ? 'bg-green-100 text-green-600'
                                                                : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            <Activity className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-semibold text-gray-900">
                                                                {log.status === 'active' ? '정상(Active) 전환' : '휴원(Suspended) 전환'}
                                                            </p>
                                                            <div className="flex items-center text-sm text-gray-500 mt-1">
                                                                <Calendar className="w-3 h-3 mr-1" />
                                                                <span>{formatTimestamp(log.changed_at)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* Action Buttons */}
                                <div className="flex space-x-3 pt-4 border-t border-gray-200">
                                    <button
                                        onClick={() => navigate('/admin/student-history', {
                                            state: {
                                                targetUserId: selectedStudent.id,
                                                targetUserName: selectedStudent.name || selectedStudent.username
                                            }
                                        })}
                                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        전체 학습 기록 보기
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDetailModal(false);
                                            setSelectedStudent(null);
                                            setStatusLogs([]);
                                        }}
                                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                                    >
                                        닫기
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, Calendar, X } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, updateDoc, deleteDoc, doc, setDoc, query, where } from 'firebase/firestore';
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

    const [selectedClass, setSelectedClass] = useState('all');

    const filteredStudents = selectedClass === 'all'
        ? students
        : students.filter(s => s.class_id === selectedClass);

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
                    <div className="space-y-4">
                        {filteredStudents.map((student) => (
                            <div key={student.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{student.name || student.username}</h3>
                                        <p className="text-sm text-gray-500">ID: {student.username}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
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
                                                    onClick={() => navigate('/admin/student-history', {
                                                        state: {
                                                            targetUserId: student.id,
                                                            targetUserName: student.name || student.username
                                                        }
                                                    })}
                                                    className="px-4 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                                                >
                                                    기록
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
            </div>
        </div>
    );
}

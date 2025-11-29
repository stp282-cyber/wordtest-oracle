import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Book, BarChart, BookOpen, UserCog, Filter, Download, DollarSign, Edit2, Megaphone, MessageCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function AdminDashboard() {
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('all');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedResult, setSelectedResult] = useState(null);

    const [studentResults, setStudentResults] = useState([]);
    const navigate = useNavigate();

    const fetchStudents = useCallback(async () => {
        try {
            const academyId = localStorage.getItem('academyId') || 'academy_default';
            const q = query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('academyId', '==', academyId)
            );
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStudents(data);
            setFilteredStudents(data);
        } catch (err) {
            console.error("Error fetching students:", err);
        }
    }, []);

    const fetchClasses = useCallback(async () => {
        try {
            const academyId = localStorage.getItem('academyId') || 'academy_default';
            const q = query(collection(db, 'classes'), where('academyId', '==', academyId));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasses(data);
        } catch (err) {
            console.error("Error fetching classes:", err);
        }
    }, []);

    const [academyName, setAcademyName] = useState('');

    useEffect(() => {
        const loadAcademy = async () => {
            try {
                const academyId = localStorage.getItem('academyId') || 'academy_default';
                const docRef = doc(db, 'academies', academyId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setAcademyName(docSnap.data().name);
                } else {
                    setAcademyName('이스턴 영어 학원'); // Fallback
                }
            } catch (err) {
                console.error("Error fetching academy:", err);
                setAcademyName('이스턴 영어 학원');
            }
        };
        loadAcademy();
        fetchStudents();
        fetchClasses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedClass === 'all') {
            setFilteredStudents(students);
        } else {
            setFilteredStudents(students.filter(s => s.class_id === selectedClass));
        }
    }, [selectedClass, students]);

    const fetchResults = async (id) => {
        try {
            const q = query(collection(db, 'test_results'), where('user_id', '==', id));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by date desc
            data.sort((a, b) => new Date(b.date) - new Date(a.date));
            setStudentResults(data);
            setSelectedStudent(id);
        } catch (err) {
            console.error("Error fetching results:", err);
        }
    };

    const handleBackup = async () => {
        if (!window.confirm('모든 데이터를 백업하시겠습니까?')) return;

        try {
            const collections = ['users', 'classes', 'words', 'test_results'];
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
            alert('백업 중 오류가 발생했습니다.');
        }
    };

    const handleResultClick = (result) => {
        setSelectedResult(result);
    };

    const closeResultModal = () => {
        setSelectedResult(null);
    };

    const handleUpdateDollar = async (studentId, currentBalance) => {
        const newBalanceStr = prompt("새로운 달러 잔액을 입력하세요:", currentBalance);
        if (newBalanceStr === null) return;

        const newBalance = parseFloat(newBalanceStr);
        if (isNaN(newBalance)) {
            alert("유효한 숫자를 입력해주세요.");
            return;
        }

        try {
            await updateDoc(doc(db, 'users', studentId), {
                dollar_balance: newBalance
            });

            // Update local state
            setStudents(prev => prev.map(s => s.id === studentId ? { ...s, dollar_balance: newBalance } : s));
            alert("달러 잔액이 수정되었습니다.");
        } catch (error) {
            console.error("Error updating dollar balance:", error);
            alert("수정 중 오류가 발생했습니다.");
        }
    };

    const handleOpenChat = async (e, student) => {
        e.stopPropagation(); // Prevent row click
        try {
            const adminId = localStorage.getItem('userId');
            const adminName = localStorage.getItem('name') || '선생님';
            const academyId = localStorage.getItem('academyId') || 'academy_default';

            // Check if chat exists
            const q = query(
                collection(db, 'chats'),
                where('teacherId', '==', adminId),
                where('studentId', '==', student.id)
            );
            const snapshot = await getDocs(q);

            let chatId;
            if (!snapshot.empty) {
                chatId = snapshot.docs[0].id;
            } else {
                // Create new chat
                const chatRef = doc(collection(db, 'chats'));
                await setDoc(chatRef, {
                    studentId: student.id,
                    studentName: student.name || student.username,
                    teacherId: adminId,
                    teacherName: adminName,
                    academyId: academyId,
                    lastMessage: '대화를 시작해보세요!',
                    updatedAt: serverTimestamp(),
                    unreadCount: { [adminId]: 0, [student.id]: 0 }
                });
                chatId = chatRef.id;
            }

            // Dispatch event to open messenger
            window.dispatchEvent(new CustomEvent('open-chat', {
                detail: {
                    chatId,
                    recipientId: student.id,
                    recipientName: student.name || student.username
                }
            }));

        } catch (error) {
            console.error("Error opening chat:", error);
            alert('채팅을 열 수 없습니다.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            {/* ... (existing header) */}
            <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-indigo-600 rounded-lg">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">선생님 대시보드</h1>
                            <p className="text-sm text-gray-500">{academyName || 'Loading...'}</p>
                        </div>
                    </div>
                    {/* Navigation buttons moved to AdminMenu in Layout */}
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Student List */}
                    <div className="bg-white rounded-2xl shadow-sm p-6 col-span-1 h-[calc(100vh-200px)] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold flex items-center">
                                <Users className="w-5 h-5 mr-2 text-gray-500" />
                                학생 목록
                            </h2>
                            <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                                {filteredStudents.length}명
                            </span>
                        </div>

                        <div className="mb-4">
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <select
                                    value={selectedClass}
                                    onChange={(e) => setSelectedClass(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
                                >
                                    <option value="all">전체 학생 보기</option>
                                    {classes.map(cls => (
                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {filteredStudents.map(student => {
                                const getStatus = () => {
                                    const today = new Date().toISOString().split('T')[0];
                                    if (student.last_study_date === today) return { label: '완료', color: 'bg-green-600' };
                                    if (student.last_login === today) return { label: '진행중', color: 'bg-blue-600' };
                                    return { label: '미완료', color: 'bg-gray-400' };
                                };
                                const status = getStatus();

                                return (
                                    <button
                                        key={student.id}
                                        onClick={() => fetchResults(student.id)}
                                        className={`w-full text-left p-3 rounded-lg transition-colors border ${selectedStudent === student.id ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white border-transparent hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0 mr-2">
                                                <div className="font-medium truncate flex items-center">
                                                    {student.name || student.username}
                                                    <span className="ml-2 flex items-center text-green-600 text-xs bg-green-50 px-1.5 py-0.5 rounded">
                                                        <DollarSign className="w-3 h-3 mr-0.5" />
                                                        {Number(student.dollar_balance || 0).toFixed(2)}
                                                    </span>
                                                    <div
                                                        onClick={(e) => handleOpenChat(e, student)}
                                                        className="ml-2 p-1 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors cursor-pointer"
                                                        title="메시지 보내기"
                                                    >
                                                        <MessageCircle className="w-4 h-4" />
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5 truncate">현재 진도: 단어 {student.current_word_index}번</div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <div className={`px-3 py-1.5 rounded text-white text-xs font-bold shadow-sm ${status.color}`}>
                                                    {status.label}
                                                </div>
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full min-w-[30px] text-center">
                                                    {classes.find(c => c.id === student.class_id)?.name || '미배정'}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                            {filteredStudents.length === 0 && (
                                <p className="text-center text-gray-400 py-4 text-sm">학생이 없습니다.</p>
                            )}
                        </div>
                    </div>

                    {/* Detailed View */}
                    <div className="bg-white rounded-2xl shadow-sm p-6 col-span-2 h-[calc(100vh-200px)] overflow-y-auto">
                        {selectedStudent ? (
                            <>
                                {(() => {
                                    const student = students.find(s => s.id === selectedStudent);
                                    return student && (
                                        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                                                    <Users className="w-6 h-6 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900">{student.name}</h3>
                                                    <p className="text-sm text-gray-500">{student.username}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500 mb-1">보유 달러</p>
                                                    <div className="flex items-center text-green-600 font-bold text-xl">
                                                        <DollarSign className="w-5 h-5 mr-1" />
                                                        {Number(student.dollar_balance || 0).toFixed(2)}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleUpdateDollar(student.id, student.dollar_balance || 0)}
                                                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
                                <h2 className="text-lg font-semibold mb-6 flex items-center">
                                    <BarChart className="w-5 h-5 mr-2 text-gray-500" />
                                    학습 기록
                                </h2>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-100 text-gray-500">
                                                <th className="pb-3 font-medium">예정 날짜</th>
                                                <th className="pb-3 font-medium">완료 날짜</th>
                                                <th className="pb-3 font-medium">시험 유형</th>
                                                <th className="pb-3 font-medium">첫 시도</th>
                                                <th className="pb-3 font-medium">최종 점수</th>
                                                <th className="pb-3 font-medium">재시험</th>
                                                <th className="pb-3 font-medium">범위</th>
                                                <th className="pb-3 font-medium">완료</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {studentResults.map(result => (
                                                <tr
                                                    key={result.id}
                                                    onClick={() => handleResultClick(result)}
                                                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                                                >
                                                    <td className="py-3 text-gray-500">
                                                        {result.scheduled_date ? new Date(result.scheduled_date).toLocaleDateString('ko-KR') : '-'}
                                                    </td>
                                                    <td className="py-3 text-gray-600">{new Date(result.date).toLocaleDateString('ko-KR')}</td>
                                                    <td className="py-3">
                                                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${result.test_type === 'new_words'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-purple-100 text-purple-700'
                                                            }`}>
                                                            {result.test_type === 'new_words' ? '기본 단어' : '복습 단어'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3">
                                                        <span className={`px-2 py-1 rounded-md font-medium ${(result.first_attempt_score || result.score) >= 80 ? 'bg-green-100 text-green-700' :
                                                            (result.first_attempt_score || result.score) >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-red-100 text-red-700'
                                                            }`}>
                                                            {result.first_attempt_score || result.score}점
                                                        </span>
                                                    </td>
                                                    <td className="py-3">
                                                        <span className={`px-2 py-1 rounded-md font-medium ${result.score >= 80 ? 'bg-green-100 text-green-700' :
                                                            result.score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-red-100 text-red-700'
                                                            }`}>
                                                            {result.score}점
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-gray-600">
                                                        {result.retry_count || 0}회
                                                    </td>
                                                    <td className="py-3 text-gray-500">
                                                        단어 {result.range_start || '?'} - {result.range_end}
                                                    </td>
                                                    <td className="py-3">
                                                        {result.completed ? (
                                                            <span className="text-green-600">✓</span>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {studentResults.length === 0 && (
                                        <p className="text-center text-gray-400 py-8">아직 시험 기록이 없습니다.</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Book className="w-12 h-12 mb-4 opacity-20" />
                                <p>학생을 선택하여 상세 정보를 확인하세요.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div >

            {/* Result Detail Modal */}
            {
                selectedResult && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">시험 상세 결과</h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {new Date(selectedResult.date).toLocaleString('ko-KR')} |
                                        {selectedResult.test_type === 'new_words' ? ' 기본 단어' : ' 복습 단어'} |
                                        범위: {selectedResult.range_start} ~ {selectedResult.range_end}
                                    </p>
                                </div>
                                <button onClick={closeResultModal} className="text-gray-400 hover:text-gray-600">
                                    <span className="text-2xl">×</span>
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1">
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="bg-blue-50 p-4 rounded-xl text-center">
                                        <p className="text-sm text-blue-600 font-medium mb-1">최종 점수</p>
                                        <p className="text-2xl font-bold text-blue-700">{selectedResult.score}점</p>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-xl text-center">
                                        <p className="text-sm text-purple-600 font-medium mb-1">첫 시도 점수</p>
                                        <p className="text-2xl font-bold text-purple-700">{selectedResult.first_attempt_score || selectedResult.score}점</p>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-xl text-center">
                                        <p className="text-sm text-gray-600 font-medium mb-1">재시험 횟수</p>
                                        <p className="text-2xl font-bold text-gray-700">{selectedResult.retry_count || 0}회</p>
                                    </div>
                                </div>

                                <h3 className="font-bold text-gray-800 mb-4">문항별 상세 내역</h3>
                                <div className="border rounded-xl overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 font-medium text-gray-600">번호</th>
                                                <th className="px-4 py-3 font-medium text-gray-600">단어 (영어)</th>
                                                <th className="px-4 py-3 font-medium text-gray-600">뜻 (한글)</th>
                                                <th className="px-4 py-3 font-medium text-gray-600">제출한 답</th>
                                                <th className="px-4 py-3 font-medium text-gray-600 text-center">결과</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {selectedResult.details ? (
                                                JSON.parse(selectedResult.details).map((detail, index) => (
                                                    <tr key={index} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                                                        <td className="px-4 py-3 font-medium">{detail.word?.english}</td>
                                                        <td className="px-4 py-3 text-gray-600">{detail.word?.korean}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={detail.correct ? 'text-green-600' : 'text-red-500 font-medium'}>
                                                                {detail.userAnswer || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {detail.correct ? (
                                                                <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-bold">정답</span>
                                                            ) : (
                                                                <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-bold">오답</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="5" className="px-4 py-8 text-center text-gray-400">상세 내역 정보가 없습니다.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                                <button
                                    onClick={closeResultModal}
                                    className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium"
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

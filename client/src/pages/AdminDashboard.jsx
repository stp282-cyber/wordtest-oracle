import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Book, BarChart, BookOpen, UserCog, Filter, Download } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function AdminDashboard() {
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('all');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentResults, setStudentResults] = useState([]);
    const navigate = useNavigate();

    const fetchStudents = async () => {
        try {
            const q = query(collection(db, 'users'), where('role', '==', 'student'));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStudents(data);
            setFilteredStudents(data);
        } catch (err) {
            console.error("Error fetching students:", err);
        }
    };

    const fetchClasses = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'classes'));
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasses(data);
        } catch (err) {
            console.error("Error fetching classes:", err);
        }
    };

    useEffect(() => {
        fetchStudents();
        fetchClasses();
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

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-indigo-600 rounded-lg">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">선생님 대시보드</h1>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleBackup}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            <span className="text-sm font-medium">데이터 백업</span>
                        </button>
                        <button
                            onClick={() => navigate('/admin/students')}
                            className="flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <UserCog className="w-4 h-4 mr-2" />
                            <span className="text-sm font-medium">학생 관리</span>
                        </button>
                        <button
                            onClick={() => navigate('/admin/classes')}
                            className="flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <Users className="w-4 h-4 mr-2" />
                            <span className="text-sm font-medium">반 관리</span>
                        </button>
                        <button
                            onClick={() => navigate('/admin/words')}
                            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            <BookOpen className="w-4 h-4 mr-2" />
                            <span className="text-sm font-medium">단어 관리</span>
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Student List */}
                    <div className="bg-white rounded-2xl shadow-sm p-6 col-span-1 h-[calc(100vh-200px)] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold flex items-center">
                                <Users className="w-5 h-5 mr-2 text-gray-500" />
                                학생 목록
                            </h2>
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
                            {filteredStudents.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => fetchResults(student.id)}
                                    className={`w-full text-left p-3 rounded-lg transition-colors ${selectedStudent === student.id ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium">{student.name || student.username}</span>
                                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                            {classes.find(c => c.id === student.class_id)?.name || '미배정'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">현재 진도: 단어 {student.current_word_index}번</div>
                                </button>
                            ))}
                            {filteredStudents.length === 0 && (
                                <p className="text-center text-gray-400 py-4 text-sm">학생이 없습니다.</p>
                            )}
                        </div>
                    </div>

                    {/* Detailed View */}
                    <div className="bg-white rounded-2xl shadow-sm p-6 col-span-2 h-[calc(100vh-200px)] overflow-y-auto">
                        {selectedStudent ? (
                            <>
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
                                                <tr key={result.id}>
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
            </div>
        </div>
    );
}

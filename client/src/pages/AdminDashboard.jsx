import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Book, BarChart, BookOpen, UserCog } from 'lucide-react';

export default function AdminDashboard() {
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentResults, setStudentResults] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        const res = await fetch('http://localhost:5000/api/admin/students');
        const data = await res.json();
        setStudents(data);
    };

    const fetchResults = async (id) => {
        const res = await fetch(`http://localhost:5000/api/admin/students/${id}/results`);
        const data = await res.json();
        setStudentResults(data);
        setSelectedStudent(id);
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
                    <div className="bg-white rounded-2xl shadow-sm p-6 col-span-1">
                        <h2 className="text-lg font-semibold mb-4 flex items-center">
                            <Users className="w-5 h-5 mr-2 text-gray-500" />
                            학생 목록
                        </h2>
                        <div className="space-y-2">
                            {students.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => fetchResults(student.id)}
                                    className={`w-full text-left p-3 rounded-lg transition-colors ${selectedStudent === student.id ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="font-medium">{student.username}</div>
                                    <div className="text-xs text-gray-500">현재 진도: 단어 {student.current_word_index}번</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Detailed View */}
                    <div className="bg-white rounded-2xl shadow-sm p-6 col-span-2">
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
                                                <th className="pb-3 font-medium">날짜</th>
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

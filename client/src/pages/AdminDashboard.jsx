import React, { useEffect, useState } from 'react';
import { Users, BarChart, Book, DollarSign, Eye, X, FileText } from 'lucide-react';
import { getStudents, getStudyHistory } from '../api/client';

export default function AdminDashboard() {
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentResults, setStudentResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailStudent, setDetailStudent] = useState(null);

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            const data = await getStudents();
            setStudents(data);
        } catch (err) {
            console.error("Error fetching students:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchResults = async (studentId) => {
        try {
            const data = await getStudyHistory(studentId);
            setStudentResults(data.tests || []);
            setSelectedStudent(studentId);
        } catch (err) {
            console.error("Error fetching results:", err);
        }
    };

    const handleViewDetails = (e, student) => {
        e.stopPropagation();
        setDetailStudent(student);
        setShowDetailModal(true);
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-indigo-600 rounded-lg">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">선생님 대시보드</h1>
                            <p className="text-sm text-gray-500">이스턴 영어 학원</p>
                        </div>
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
                            <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                                {students.length}명
                            </span>
                        </div>

                        <div className="space-y-2">
                            {students.map(student => (
                                <div
                                    key={student.ID || student.id}
                                    onClick={() => fetchResults(student.ID || student.id)}
                                    className={`w-full text-left p-3 rounded-lg transition-colors border cursor-pointer ${selectedStudent === (student.ID || student.id) ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white border-transparent hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 mr-2">
                                            <div className="font-medium truncate flex items-center">
                                                {student.USERNAME || student.username}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={(e) => handleViewDetails(e, student)}
                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="상세 정보"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {students.length === 0 && (
                                <p className="text-center text-gray-400 py-4 text-sm">학생이 없습니다.</p>
                            )}
                        </div>
                    </div>

                    {/* Detailed View */}
                    <div className="bg-white rounded-2xl shadow-sm p-6 col-span-2 h-[calc(100vh-200px)] overflow-y-auto">
                        {selectedStudent ? (
                            <>
                                {(() => {
                                    const student = students.find(s => (s.ID || s.id) === selectedStudent);
                                    return student && (
                                        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                                                    <Users className="w-6 h-6 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900">{student.USERNAME || student.username}</h3>
                                                    <p className="text-sm text-gray-500">{student.EMAIL || student.email}</p>
                                                </div>
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
                                                <th className="pb-3 font-medium">날짜</th>
                                                <th className="pb-3 font-medium">점수</th>
                                                <th className="pb-3 font-medium">총 문항</th>
                                                <th className="pb-3 font-medium">정답</th>
                                                <th className="pb-3 font-medium">오답</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {studentResults.map((result, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                    <td className="py-3 text-gray-600">
                                                        {new Date(result.DATE_TAKEN || result.date_taken).toLocaleDateString('ko-KR')}
                                                    </td>
                                                    <td className="py-3">
                                                        <span className={`px-2 py-1 rounded-md font-medium ${(result.SCORE || result.score) >= 80 ? 'bg-green-100 text-green-700' :
                                                            (result.SCORE || result.score) >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-red-100 text-red-700'
                                                            }`}>
                                                            {result.SCORE || result.score}점
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-gray-600">{result.TOTAL_QUESTIONS || result.total_questions}</td>
                                                    <td className="py-3 text-green-600">{result.CORRECT_ANSWERS || result.correct_answers}</td>
                                                    <td className="py-3 text-red-600">{result.WRONG_ANSWERS || result.wrong_answers}</td>
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

            {/* Student Detail Modal */}
            {
                showDetailModal && detailStudent && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-md w-full">
                            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900">학생 정보</h2>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-sm text-gray-500">이름</label>
                                    <p className="font-medium text-gray-900">{detailStudent.USERNAME || detailStudent.username}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">이메일</label>
                                    <p className="font-medium text-gray-900">{detailStudent.EMAIL || detailStudent.email}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">ID</label>
                                    <p className="font-medium text-gray-900">{detailStudent.ID || detailStudent.id}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-500">가입일</label>
                                    <p className="font-medium text-gray-900">
                                        {detailStudent.CREATED_AT || detailStudent.created_at
                                            ? new Date(detailStudent.CREATED_AT || detailStudent.created_at).toLocaleDateString()
                                            : '-'}
                                    </p>
                                </div>
                            </div>
                            <div className="p-6 border-t border-gray-200 flex justify-end">
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
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

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';

export default function StudyHistory() {
    const [history, setHistory] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        const userId = localStorage.getItem('userId');
        try {
            const res = await fetch('http://localhost:5000/api/student/history', {
                headers: { 'x-user-id': userId },
            });
            const data = await res.json();
            if (res.ok) {
                setHistory(data.history || []);
            } else {
                alert(data.message || '학습 기록을 불러오지 못했습니다.');
                navigate('/student');
            }
        } catch (err) {
            console.error(err);
            alert('서버 연결에 실패했습니다.');
            navigate('/student');
        }
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <header className="flex items-center mb-6">
                <button onClick={() => navigate('/student')} className="p-2 mr-2 hover:text-indigo-600 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold text-gray-800">내 학습 기록</h1>
            </header>

            {history.length === 0 ? (
                <p className="text-gray-500">학습 기록이 없습니다.</p>
            ) : (
                <div className="space-y-8">
                    {history.map((day) => (
                        <div key={day.date} className="bg-white rounded-xl shadow-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-gray-800">{formatDate(day.date)}</h2>
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>점수: {day.score} / 100 ({day.percent}%)</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-700">
                                <div>총 문제: {day.total}</div>
                                <div>정답: {day.correct}</div>
                                <div>오답: {day.wrong}</div>
                                <div>백점 만점: 100</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full table-auto border border-gray-200">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">문제번호</th>
                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">문제명</th>
                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">문제유형</th>
                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">정답여부</th>
                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">학생 작성 답안</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {day.details && day.details.map((item, idx) => (
                                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-4 py-2 text-sm text-gray-800">{item.questionNumber}</td>
                                                <td className="px-4 py-2 text-sm text-gray-800">{item.questionName}</td>
                                                <td className="px-4 py-2 text-sm text-gray-800">{item.questionType}</td>
                                                <td className="px-4 py-2 text-sm text-gray-800">
                                                    {item.isCorrect ? '정답' : '오답'}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-800">{item.userAnswer}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

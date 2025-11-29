import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle, DollarSign, Calendar, TrendingUp, Activity } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export default function StudyHistory() {
    const [history, setHistory] = useState([]);
    const [dollarHistory, setDollarHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('tests'); // 'tests', 'dollars'
    const navigate = useNavigate();
    const location = useLocation();
    const targetUserId = location.state?.targetUserId;
    const targetUserName = location.state?.targetUserName;

    const fetchHistory = useCallback(async () => {
        const userId = targetUserId || localStorage.getItem('userId');
        try {
            // Fetch Test Results
            let rawHistory = [];
            try {
                const q = query(
                    collection(db, 'test_results'),
                    where('user_id', '==', userId),
                    orderBy('date', 'desc'),
                    limit(50)
                );
                const querySnapshot = await getDocs(q);
                rawHistory = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (queryError) {
                console.warn("Test results index query failed, falling back to client-side sorting:", queryError);
                const fallbackQuery = query(
                    collection(db, 'test_results'),
                    where('user_id', '==', userId)
                );
                const fallbackSnapshot = await getDocs(fallbackQuery);
                rawHistory = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort client-side
                rawHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
                // Limit client-side
                rawHistory = rawHistory.slice(0, 50);
            }

            // Sort by date desc (ensure sorted even if query succeeded, though query does it)
            // If fallback was used, it's already sorted. If query used, it's already sorted.
            // But re-sorting doesn't hurt to be safe if we mix logic.
            // Actually, let's trust the block above.

            const formattedHistory = rawHistory.map(record => {
                let details = [];
                try {
                    details = typeof record.details === 'string' ? JSON.parse(record.details) : record.details;
                } catch (e) {
                    console.error("Failed to parse details JSON", e);
                }

                const total = details.length;
                const correct = details.filter(d => d.correct).length;
                const wrong = total - correct;
                const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

                return {
                    date: record.date,
                    score: record.score,
                    percent,
                    total,
                    correct,
                    wrong,
                    newWordsScore: record.new_words_score,
                    newWordsTotal: record.new_words_total,
                    newWordsCorrect: record.new_words_correct,
                    reviewWordsScore: record.review_words_score,
                    reviewWordsTotal: record.review_words_total,
                    reviewWordsCorrect: record.review_words_correct,
                    details: details.map(d => ({
                        questionNumber: d.word?.word_number || '?',
                        questionName: d.word?.english || '?',
                        questionType: d.word?.korean ? '주관식' : '객관식',
                        isCorrect: d.correct,
                        userAnswer: d.userAnswer
                    }))
                };
            });

            setHistory(formattedHistory);

            // Fetch Dollar History
            let rawDollarHistory = [];
            try {
                const dollarQ = query(
                    collection(db, 'dollar_history'),
                    where('user_id', '==', userId),
                    orderBy('date', 'desc'),
                    limit(50)
                );
                const dollarSnapshot = await getDocs(dollarQ);
                rawDollarHistory = dollarSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (queryError) {
                console.warn("Dollar history index query failed, falling back to client-side sorting:", queryError);
                const fallbackQuery = query(
                    collection(db, 'dollar_history'),
                    where('user_id', '==', userId)
                );
                const fallbackSnapshot = await getDocs(fallbackQuery);
                rawDollarHistory = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                rawDollarHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
                rawDollarHistory = rawDollarHistory.slice(0, 50);
            }
            setDollarHistory(rawDollarHistory);

        } catch (err) {
            console.error(err);
            alert('학습 기록을 불러오지 못했습니다.');
            navigate('/student');
        }
    }, [navigate, targetUserId]);

    useEffect(() => {
        fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetUserId]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const handleBack = () => {
        if (targetUserId) {
            navigate('/admin/students');
        } else {
            navigate('/student');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 font-sans">
            <header className="flex items-center mb-6">
                <button onClick={handleBack} className="p-2 mr-2 hover:text-indigo-600 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold text-gray-800">
                    {targetUserName ? `${targetUserName} 학생의 학습 기록` : '내 학습 기록'}
                </h1>
            </header>

            {/* Tabs */}
            <div className="flex space-x-4 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('tests')}
                    className={`pb-2 px-4 font-medium transition-colors relative ${activeTab === 'tests' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    시험 결과
                    {activeTab === 'tests' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></div>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('dollars')}
                    className={`pb-2 px-4 font-medium transition-colors relative ${activeTab === 'dollars' ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    달러 내역
                    {activeTab === 'dollars' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-green-600 rounded-t-full"></div>
                    )}
                </button>
            </div>

            {activeTab === 'tests' && (
                history.length === 0 ? (
                    <p className="text-gray-500 text-center py-10">학습 기록이 없습니다.</p>
                ) : (
                    <div className="space-y-8">
                        {history.map((day, index) => (
                            <div key={index} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-semibold text-gray-800">{formatDate(day.date)}</h2>
                                    <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                                        <CheckCircle className="w-4 h-4 text-indigo-500" />
                                        <span className="font-medium">점수: {day.score} / 100 ({day.percent}%)</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-700">
                                    <div>총 문제: {day.total}</div>
                                    <div>정답: {day.correct}</div>
                                    <div>오답: {day.wrong}</div>
                                    <div>백점 만점: 100</div>
                                    {day.newWordsTotal !== undefined && (
                                        <>
                                            <div className="col-span-2 border-t border-gray-100 my-2"></div>
                                            <div className="text-indigo-600 font-medium">기본 단어: {day.newWordsScore}점 ({day.newWordsCorrect}/{day.newWordsTotal})</div>
                                            <div className="text-blue-600 font-medium">복습 단어: {day.reviewWordsScore}점 ({day.reviewWordsCorrect}/{day.reviewWordsTotal})</div>
                                        </>
                                    )}
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="min-w-full table-auto">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">문제번호</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">문제명</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">문제유형</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">정답여부</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">학생 작성 답안</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {day.details && day.details.map((item, idx) => (
                                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                                    <td className="px-4 py-3 text-sm text-gray-800">{item.questionNumber}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-800 font-medium">{item.questionName}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{item.questionType}</td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                            }`}>
                                                            {item.isCorrect ? '정답' : '오답'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-800">{item.userAnswer}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {activeTab === 'dollars' && (
                dollarHistory.length === 0 ? (
                    <p className="text-gray-500 text-center py-10">달러 내역이 없습니다.</p>
                ) : (
                    <div className="space-y-4">
                        {dollarHistory.map((item, index) => (
                            <div key={index} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                                <div className="flex items-center space-x-4">
                                    <div className={`p-3 rounded-full ${item.amount >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        {item.amount >= 0 ? <TrendingUp className="w-6 h-6" /> : <DollarSign className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-lg">{item.reason}</p>
                                        <div className="flex items-center text-sm text-gray-500 space-x-2">
                                            <Calendar className="w-3 h-3" />
                                            <span>{formatDate(item.date)}</span>
                                            <span className="text-gray-300">|</span>
                                            <span className="capitalize">{item.type === 'earned' ? '획득' : item.type === 'adjusted' ? '관리자 수정' : item.type}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`text-xl font-bold ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {item.amount >= 0 ? '+' : ''}{item.amount.toFixed(2)} $
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

        </div>
    );
}

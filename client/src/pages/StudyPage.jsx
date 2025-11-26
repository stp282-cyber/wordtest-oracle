import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, Check } from 'lucide-react';

export default function StudyPage() {
    const [loading, setLoading] = useState(true);
    const [words, setWords] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchWords();
    }, []);

    const fetchWords = async () => {
        const userId = localStorage.getItem('userId');
        const studyStartIndex = localStorage.getItem('studyStartIndex');

        try {
            let url = `http://localhost:5000/api/student/test?userId=${userId}`;
            if (studyStartIndex) {
                url += `&startIndex=${studyStartIndex}`;
            }

            const res = await fetch(url);
            const data = await res.json();
            if (res.ok) {
                // Only show new words for initial study
                setWords(data.newWords || []);
                setLoading(false);
            } else {
                alert(data.message || '단어 불러오기 실패');
                navigate('/student');
            }
        } catch (err) {
            console.error(err);
            alert('서버 연결 실패');
            navigate('/student');
        }
    };

    const handleStartTest = () => {
        navigate('/student/test');
    };

    if (loading) {
        return <div className="p-8 text-center">단어 불러오는 중...</div>;
    }

    if (words.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">학습할 단어가 없습니다</h1>
                    <p className="text-gray-600 mb-6">관리자에게 문의하세요.</p>
                    <button
                        onClick={() => navigate('/student')}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                        돌아가기
                    </button>
                </div>
            </div>
        );
    }

    // Speech synthesis helper
    const speakWord = (text) => {
        if (!window.speechSynthesis) return;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'en-US';
        window.speechSynthesis.speak(utter);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-indigo-600 text-white p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <BookOpen className="w-8 h-8" />
                                <div>
                                    <h1 className="text-2xl font-bold">오늘의 기본 학습 단어</h1>
                                    <p className="text-indigo-200 text-sm">총 {words.length}개의 새로운 단어를 학습합니다</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Word List */}
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {words.map((word, index) => (
                                <div
                                    key={word.id}
                                    className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-indigo-300 transition-all cursor-pointer"
                                    onClick={() => speakWord(word.english)}
                                    aria-label={`발음 듣기: ${word.english}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                                    {index + 1}
                                                </span>
                                                {word.word_number && (
                                                    <span className="text-xs text-gray-500">
                                                        #{word.word_number}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-xl font-bold text-gray-900 mb-1">
                                                {word.english}
                                            </h3>
                                            <p className="text-gray-600">
                                                {word.korean}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Study Complete Button */}
                        <div className="border-t border-gray-200 pt-6">
                            <button
                                onClick={handleStartTest}
                                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2"
                            >
                                <Check className="w-6 h-6" />
                                <span>학습 완료 - 시험 시작하기</span>
                                <ArrowRight className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

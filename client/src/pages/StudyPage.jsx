import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, ArrowRight, Check } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export default function StudyPage() {
    const [loading, setLoading] = useState(true);
    const [words, setWords] = useState([]);
    const [rangeInfo, setRangeInfo] = useState({ start: 0, end: 0 });
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const fetchWords = async () => {
            const userId = localStorage.getItem('userId');

            // Prioritize location state, then localStorage
            let studyStartIndex = location.state?.studyStartIndex || localStorage.getItem('studyStartIndex');
            let studyEndIndex = location.state?.studyEndIndex || localStorage.getItem('studyEndIndex');

            try {
                // 1. Get User Settings
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (!userDoc.exists()) {
                    alert('사용자 설정을 찾을 수 없습니다.');
                    navigate('/student');
                    return;
                }
                const settings = userDoc.data();
                const bookName = location.state?.bookName || settings.book_name || '기본';

                const bookSettings = settings.book_settings?.[bookName] || {};
                const bookWordsPerSession = bookSettings.words_per_session ? parseInt(bookSettings.words_per_session) : null;
                const wordsPerSession = bookWordsPerSession || settings.words_per_session || 10;

                let currentWordIndex = 0;
                if (settings.book_progress && settings.book_progress[bookName] !== undefined) {
                    currentWordIndex = settings.book_progress[bookName];
                } else if (bookName === settings.book_name) {
                    currentWordIndex = settings.current_word_index || 0;
                }

                // 2. Determine Range
                let startWordNumber;
                let endWordNumber;

                if (studyStartIndex && studyEndIndex) {
                    startWordNumber = parseInt(studyStartIndex);
                    endWordNumber = parseInt(studyEndIndex);
                } else if (studyStartIndex) {
                    startWordNumber = parseInt(studyStartIndex);
                    endWordNumber = startWordNumber + wordsPerSession;
                } else {
                    startWordNumber = currentWordIndex + 1;
                    endWordNumber = startWordNumber + wordsPerSession;
                }

                setRangeInfo({ start: startWordNumber, end: endWordNumber });

                // 3. Fetch Words (Fetch all for book and filter in JS to avoid index issues)
                const wordsQuery = query(
                    collection(db, 'words'),
                    where('book_name', '==', bookName)
                );
                const querySnapshot = await getDocs(wordsQuery);
                const allWords = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // 4. Filter and Sort
                const targetWords = allWords
                    .filter(w => w.word_number >= startWordNumber && w.word_number < endWordNumber)
                    .sort((a, b) => a.word_number - b.word_number);

                setWords(targetWords);
                setLoading(false);

            } catch (err) {
                console.error(err);
                alert('데이터 불러오기 실패: ' + err.message);
                navigate('/student');
            }
        };

        fetchWords();
    }, [location.state, navigate]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Prevent Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A (and Cmd+ for Mac)
            if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
                e.preventDefault();
                alert('단축키를 사용할 수 없습니다.');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleStartTest = () => {
        navigate('/student/test', {
            state: {
                studyStartIndex: rangeInfo.start,
                studyEndIndex: rangeInfo.end,
                scheduledDate: location.state?.scheduledDate,
                bookName: location.state?.bookName
            }
        });
    };

    if (loading) {
        return <div className="p-8 text-center">단어 불러오는 중...</div>;
    }

    if (words.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">학습할 단어가 없습니다</h1>
                    <p className="text-gray-600 mb-6">모든 단어를 학습했거나 단어장이 비어있습니다.</p>
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
        <div
            className="min-h-screen bg-gray-50 p-8"
            onCopy={(e) => e.preventDefault()}
            onPaste={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
        >
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
                        <div className="border-t border-gray-200 pt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <button
                                onClick={() => navigate('/student/game', { state: location.state })}
                                className="py-4 bg-green-500 text-white rounded-xl font-bold text-lg hover:bg-green-600 transition-all flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                <span className="text-2xl">🎮</span>
                                <span className="text-sm md:text-base">카드 뒤집기</span>
                            </button>
                            <button
                                onClick={() => navigate('/student/scramble', { state: location.state })}
                                className="py-4 bg-yellow-500 text-white rounded-xl font-bold text-lg hover:bg-yellow-600 transition-all flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                <span className="text-2xl">🧩</span>
                                <span className="text-sm md:text-base">단어 조합</span>
                            </button>
                            <button
                                onClick={() => navigate('/student/speed', { state: location.state })}
                                className="py-4 bg-pink-500 text-white rounded-xl font-bold text-lg hover:bg-pink-600 transition-all flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                <span className="text-2xl">⚡</span>
                                <span className="text-sm md:text-base">스피드 퀴즈</span>
                            </button>
                            <button
                                onClick={() => navigate('/student/rain', { state: location.state })}
                                className="py-4 bg-blue-500 text-white rounded-xl font-bold text-lg hover:bg-blue-600 transition-all flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                <span className="text-2xl">🌧️</span>
                                <span className="text-sm md:text-base">단어 소나기</span>
                            </button>
                            <button
                                onClick={handleStartTest}
                                className="py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                <Check className="w-6 h-6" />
                                <span className="text-sm md:text-base">시험 시작</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, RotateCcw, BookOpen } from 'lucide-react';

export default function TestInterface() {
    const [loading, setLoading] = useState(true);
    const [newWords, setNewWords] = useState([]);
    const [reviewWords, setReviewWords] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [testMode, setTestMode] = useState('new');
    const [retryMode, setRetryMode] = useState(false);
    const [currentTestWords, setCurrentTestWords] = useState([]);
    const [answers, setAnswers] = useState({});
    const [wrongWords, setWrongWords] = useState([]);
    const [showWrongWordsReview, setShowWrongWordsReview] = useState(false);
    const [rangeEnd, setRangeEnd] = useState(0);
    const [allTestsComplete, setAllTestsComplete] = useState(false);
    const [firstAttemptScore, setFirstAttemptScore] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    const navigate = useNavigate();

    useEffect(() => {
        fetchTest();
    }, []);

    const shuffleArray = (array) => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    // Speech synthesis helper – reads English word aloud
    const speakWord = (text) => {
        if (!window.speechSynthesis) return;
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'en-US';
        window.speechSynthesis.speak(utter);
    };

    const fetchTest = async () => {
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
                const newWordsData = data.newWords || [];
                const reviewWordsData = data.reviewWords || [];
                setNewWords(newWordsData);
                setReviewWords(reviewWordsData);
                setRangeEnd(data.rangeEnd || 0);

                if (newWordsData.length > 0) {
                    setCurrentTestWords(shuffleArray(newWordsData));
                    setTestMode('new');
                } else if (reviewWordsData.length > 0) {
                    setShowWrongWordsReview(true);
                    setWrongWords(reviewWordsData);
                    setTestMode('review-study');
                } else {
                    alert('학습할 단어가 없습니다.');
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = (answer) => {
        const currentWord = currentTestWords[currentIndex];
        const correctAnswer = testMode === 'review' ? currentWord.korean : currentWord.english;

        const normalizedAnswer = answer.trim().toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
        const normalizedCorrect = correctAnswer.trim().toLowerCase().replace(/[^a-z0-9가-힣]/g, '');

        const isCorrect = normalizedAnswer === normalizedCorrect;
        const newAnswer = { correct: isCorrect, userAnswer: answer, word: currentWord };

        setAnswers((prev) => {
            const updatedAnswers = { ...prev, [currentWord.id]: newAnswer };
            if (currentIndex >= currentTestWords.length - 1) {
                setTimeout(() => {
                    finishCurrentTestWithAnswers(updatedAnswers);
                }, 0);
            }
            return updatedAnswers;
        });

        if (currentIndex < currentTestWords.length - 1) {
            setCurrentIndex((prev) => prev + 1);
        }
    };

    const finishCurrentTestWithAnswers = (finalAnswers) => {
        const wrong = currentTestWords.filter((word) => !finalAnswers[word.id]?.correct);

        // Calculate score for this attempt
        const totalWords = currentTestWords.length;
        const correctCount = Object.values(finalAnswers).filter((a) => a.correct).length;
        const attemptScore = totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0;

        // Record first attempt score if this is the first attempt
        if (firstAttemptScore === null && !retryMode) {
            setFirstAttemptScore(attemptScore);
        }

        if (wrong.length > 0) {
            setWrongWords(wrong);
            setShowWrongWordsReview(true);
        } else {
            moveToNextPhase();
        }
    };

    const startRetry = () => {
        setShowWrongWordsReview(false);
        setRetryCount(prev => prev + 1); // Increment retry count
        if (testMode === 'review-study') {
            setTestMode('review');
            setCurrentTestWords(shuffleArray(reviewWords));
            setCurrentIndex(0);
            setAnswers({});
            setRetryMode(false);
        } else {
            setRetryMode(true);
            setCurrentTestWords(shuffleArray(wrongWords));
            setCurrentIndex(0);
            setAnswers({});
        }
    };

    const moveToNextPhase = () => {
        if (testMode === 'new' && !retryMode) {
            if (reviewWords.length > 0) {
                setShowWrongWordsReview(true);
                setWrongWords(reviewWords);
                setTestMode('review-study');
            } else {
                submitAndFinish();
            }
        } else if (testMode === 'review' && !retryMode) {
            submitAndFinish();
        } else if (retryMode) {
            setRetryMode(false);
            if (testMode === 'new') {
                if (reviewWords.length > 0) {
                    setShowWrongWordsReview(true);
                    setWrongWords(reviewWords);
                    setTestMode('review-study');
                } else {
                    submitAndFinish();
                }
            } else if (testMode === 'review') {
                submitAndFinish();
            }
        }
    };

    const submitAndFinish = () => {
        const totalWords = newWords.length + reviewWords.length;
        const allAnswers = Object.values(answers);
        const correctCount = allAnswers.filter((a) => a.correct).length;
        const score = totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0;

        const userId = localStorage.getItem('userId');
        fetch('http://localhost:5000/api/student/test/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                score,
                details: Object.entries(answers).map(([id, val]) => ({ word_id: id, ...val })),
                rangeStart: 0,
                rangeEnd,
                firstAttemptScore: firstAttemptScore || score,
                retryCount: retryCount,
                testType: testMode === 'new' ? 'new_words' : 'review_words',
                completed: true
            }),
        });

        setAllTestsComplete(true);
    };

    if (loading) return <div className="p-8 text-center">시험지 생성 중...</div>;

    if (allTestsComplete) {
        const totalWords = newWords.length + reviewWords.length;
        const correctCount = Object.values(answers).filter((a) => a.correct).length;
        const score = totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0;
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <Check className="w-10 h-10 text-green-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800">모든 학습 완료!</h1>
                    <div className="text-6xl font-black text-indigo-600">
                        {score}<span className="text-2xl text-gray-400 font-medium">점</span>
                    </div>
                    <p className="text-gray-500">
                        {totalWords}문제 중 {correctCount}개를 맞췄습니다.
                    </p>
                    <button onClick={() => navigate('/student')} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">
                        대시보드로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    if (showWrongWordsReview) {
        const isReviewStudy = testMode === 'review-study';
        const headerBgColor = isReviewStudy ? 'bg-blue-600' : 'bg-red-600';
        const headerTextColor = isReviewStudy ? 'text-blue-200' : 'text-red-200';
        const cardBgColor = isReviewStudy ? 'bg-blue-50' : 'bg-red-50';
        const cardBorderColor = isReviewStudy ? 'border-blue-200' : 'border-red-200';
        const badgeBgColor = isReviewStudy ? 'bg-blue-100' : 'bg-red-100';
        const badgeTextColor = isReviewStudy ? 'text-blue-600' : 'text-red-600';
        const buttonBgColor = isReviewStudy ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700';

        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className={`${headerBgColor} text-white p-6`}>
                            <div className="flex items-center space-x-3">
                                <BookOpen className="w-8 h-8" />
                                <div>
                                    <h1 className="text-2xl font-bold">
                                        {isReviewStudy ? '복습 단어 학습' : '오답 단어 학습'}
                                    </h1>
                                    <p className={`${headerTextColor} text-sm`}>
                                        {isReviewStudy
                                            ? `${wrongWords.length}개의 복습 단어를 학습하세요`
                                            : `틀린 ${wrongWords.length}개의 단어를 복습하세요`}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                {wrongWords.map((word, index) => (
                                    <div
                                        key={word.id}
                                        className={`p-4 ${cardBgColor} rounded-xl border ${cardBorderColor} cursor-pointer`}
                                        onClick={() => speakWord(word.english)}
                                        aria-label={`발음 듣기: ${word.english}`}
                                    >
                                        <div className="flex items-center space-x-2 mb-2">
                                            <span className={`text-xs font-medium ${badgeTextColor} ${badgeBgColor} px-2 py-1 rounded`}>
                                                {isReviewStudy ? `복습 ${index + 1}` : `오답 ${index + 1}`}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">{word.english}</h3>
                                        <p className="text-gray-600">{word.korean}</p>
                                        {!isReviewStudy && answers[word.id]?.userAnswer && (
                                            <p className="text-sm text-red-600 mt-2">내 답: {answers[word.id].userAnswer}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-gray-200 pt-6">
                                <button
                                    onClick={startRetry}
                                    className={`w-full py-4 ${buttonBgColor} text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center space-x-2`}
                                >
                                    {isReviewStudy ? (
                                        <>
                                            <Check className="w-6 h-6" />
                                            <span>학습 완료 - 복습 시험 시작하기</span>
                                        </>
                                    ) : (
                                        <>
                                            <RotateCcw className="w-6 h-6" />
                                            <span>재시험 시작하기</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const currentWord = currentTestWords[currentIndex];
    const totalProgress = currentTestWords.length;
    const currentProgress = currentIndex + 1;

    const getModeLabel = () => {
        if (retryMode) return '오답 재시험';
        if (testMode === 'new') return '기본 단어 시험';
        return '복습 시험';
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <div className="h-2 bg-gray-200">
                <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${(currentProgress / totalProgress) * 100}%` }}
                />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden">
                    <div className={`p-8 text-center text-white ${retryMode ? 'bg-red-600' : 'bg-indigo-600'}`}>
                        <span className={`text-sm font-medium uppercase tracking-wider ${retryMode ? 'text-red-200' : 'text-indigo-200'}`}>
                            {getModeLabel()} - 문제 {currentProgress} / {totalProgress}
                        </span>
                        <h2 className="mt-4 text-4xl font-bold">
                            {testMode === 'review' ? currentWord.english : currentWord.korean}
                        </h2>
                        <p className={`mt-2 text-sm ${retryMode ? 'text-red-200' : 'text-indigo-200'}`}>
                            {testMode === 'review' ? '한글 뜻을 선택하세요' : '영어 단어를 입력하세요'}
                        </p>
                    </div>
                    <div className="p-8">
                        {testMode === 'review' ? (
                            <div className="grid grid-cols-1 gap-3">
                                {(() => {
                                    const allWords = [...newWords, ...reviewWords];
                                    const distractors = allWords
                                        .filter((w) => w.id !== currentWord.id)
                                        .sort(() => 0.5 - Math.random())
                                        .slice(0, 4)
                                        .map((w) => w.korean);
                                    const options = [...distractors, currentWord.korean].sort(() => 0.5 - Math.random());
                                    return options.map((option, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleAnswer(option)}
                                            className="p-4 text-left text-lg font-medium text-gray-700 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-all border border-gray-100 hover:border-indigo-200"
                                        >
                                            {option}
                                        </button>
                                    ));
                                })()}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleAnswer(e.target.elements.input.value);
                                        e.target.reset();
                                    }}
                                >
                                    <div className="flex items-center space-x-2">
                                        <input
                                            name="input"
                                            type="text"
                                            autoFocus
                                            autoComplete="off"
                                            placeholder="영어 단어를 입력하세요..."
                                            className="flex-1 w-full p-4 text-xl border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                                        />
                                        <button
                                            type="submit"
                                            className="p-2 bg-indigo-600 rounded-full hover:bg-indigo-700 transition-all flex items-center justify-center"
                                        >
                                            <ArrowRight className="w-5 h-5 text-white" />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

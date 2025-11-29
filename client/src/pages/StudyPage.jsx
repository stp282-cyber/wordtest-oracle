import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Check } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

export default function StudyPage() {
    const [loading, setLoading] = useState(true);
    const [words, setWords] = useState([]);
    const [rangeInfo, setRangeInfo] = useState({ start: 0, end: 0 });
    const [bookName, setBookName] = useState('');
    const [debugInfo, setDebugInfo] = useState(null);
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
                const userRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userRef);

                if (!userDoc.exists()) {
                    alert('사용자 설정을 찾을 수 없습니다.');
                    navigate('/student');
                    return;
                }

                const settings = userDoc.data();
                const currentBookName = location.state?.bookName || settings.book_name || '기본';
                setBookName(currentBookName);

                const bookSettings = settings.book_settings?.[currentBookName] || {};
                const bookWordsPerSession = bookSettings.words_per_session ? parseInt(bookSettings.words_per_session) : null;
                const wordsPerSession = bookWordsPerSession || settings.words_per_session || 10;

                let currentWordIndex = 0;
                if (settings.book_progress && settings.book_progress[currentBookName] !== undefined) {
                    currentWordIndex = settings.book_progress[currentBookName];
                } else if (currentBookName === settings.book_name) {
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

                // 3. Fetch Words (Try optimized range query first, fallback to client-side filtering)
                let targetWords = [];
                try {
                    const wordsQuery = query(
                        collection(db, 'words'),
                        where('book_name', '==', currentBookName),
                        where('word_number', '>=', startWordNumber),
                        where('word_number', '<', endWordNumber)
                    );
                    const querySnapshot = await getDocs(wordsQuery);
                    targetWords = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } catch (queryError) {
                    console.warn("Index query failed, falling back to client-side filtering:", queryError);
                    // Fallback: Fetch all words for the book and filter
                    const fallbackQuery = query(
                        collection(db, 'words'),
                        where('book_name', '==', currentBookName)
                    );
                    const fallbackSnapshot = await getDocs(fallbackQuery);
                    const allBookWords = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    targetWords = allBookWords.filter(w => {
                        const wn = parseInt(w.word_number);
                        return wn >= startWordNumber && wn < endWordNumber;
                    });
                }

                // Debug Info (Updated for range query)
                setDebugInfo({
                    totalWords: targetWords.length,
                    firstWord: targetWords[0] || null,
                    lastWord: targetWords[targetWords.length - 1] || null
                });

                // 4. Sort (Filtering is done by DB or Client)
                targetWords.sort((a, b) => parseInt(a.word_number) - parseInt(b.word_number));

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

    // Auto-transition to next book only when ALL words are completed
    useEffect(() => {
        let isCancelled = false;

        const checkAutoTransition = async () => {
            if (loading) return; // Wait for loading to complete

            // Only check for auto-transition when there are no words in the current range
            // AND we have debug info showing the book has words
            if (words.length === 0 && debugInfo && debugInfo.totalWords > 0) {
                const userId = localStorage.getItem('userId');
                if (!userId) return;

                try {
                    const userRef = doc(db, 'users', userId);
                    const userDoc = await getDoc(userRef);

                    if (isCancelled) return;

                    if (userDoc.exists()) {
                        const userData = userDoc.data();

                        // Get current progress for this book
                        let currentWordIndex = 0;
                        if (userData.book_progress && userData.book_progress[bookName] !== undefined) {
                            currentWordIndex = userData.book_progress[bookName];
                        } else if (bookName === userData.book_name) {
                            currentWordIndex = userData.current_word_index || 0;
                        }

                        // CRITICAL: Check if the requested range is sequential
                        // If student clicked on a future date (skipping ahead), don't auto-transition
                        if (rangeInfo.start > currentWordIndex + 1) {
                            console.log(`Skipping ahead detected. Range start: ${rangeInfo.start}, Current progress: ${currentWordIndex}`);
                            alert('순차적으로 학습해야 합니다.\n현재 진행 중인 단어부터 학습해주세요.');
                            navigate('/student');
                            return;
                        }

                        // Get the maximum word_number in this book
                        const maxWordNumber = debugInfo.lastWord ? parseInt(debugInfo.lastWord.word_number) : 0;

                        // Only transition if current progress is beyond the last word
                        // This ensures ALL words are completed before transitioning
                        if (currentWordIndex < maxWordNumber) {
                            // Still have words to study, don't auto-transition
                            console.log(`Still have words to study. Current: ${currentWordIndex}, Max: ${maxWordNumber}`);
                            return;
                        }

                        // Changed: Get queue from curriculum_queues based on active_books index
                        const activeBooks = userData.active_books || [];
                        const bookIndex = activeBooks.findIndex(b => b === bookName);

                        // Convert curriculum_queues object to array (Firestore stores as object)
                        let curriculumQueuesArray = [];
                        const curriculumQueuesObj = userData.curriculum_queues || {};
                        if (typeof curriculumQueuesObj === 'object' && !Array.isArray(curriculumQueuesObj)) {
                            Object.keys(curriculumQueuesObj).forEach(key => {
                                curriculumQueuesArray[parseInt(key)] = curriculumQueuesObj[key] || [];
                            });
                        } else {
                            curriculumQueuesArray = curriculumQueuesObj;
                        }

                        const nextBooks = (bookIndex !== -1 && curriculumQueuesArray[bookIndex]) ? curriculumQueuesArray[bookIndex] : [];

                        if (nextBooks.length > 0) {
                            const nextBookItem = nextBooks[0];
                            const nextBookName = typeof nextBookItem === 'string' ? nextBookItem : nextBookItem.title;

                            if (!nextBookName) return;

                            // Use setTimeout to avoid blocking rendering and React state updates
                            setTimeout(async () => {
                                const confirmTransition = window.confirm(
                                    `'${bookName}' 단어장의 모든 학습이 완료되었습니다.\n다음 교재 '${nextBookName}'(으)로 이동하시겠습니까?`
                                );

                                if (confirmTransition) {
                                    const newActiveBooks = [...activeBooks];
                                    // Replace the completed book with the next one at the same index
                                    if (bookIndex !== -1) {
                                        newActiveBooks[bookIndex] = nextBookName;
                                    }

                                    const newQueuesArray = [...curriculumQueuesArray];
                                    // Update the queue for this curriculum slot
                                    if (bookIndex !== -1) {
                                        newQueuesArray[bookIndex] = nextBooks.slice(1);
                                    }

                                    // Convert array to object for Firestore (no nested arrays)
                                    const newQueuesObject = {};
                                    newQueuesArray.forEach((queue, index) => {
                                        newQueuesObject[index] = queue || [];
                                    });

                                    const updates = {
                                        active_books: newActiveBooks,
                                        curriculum_queues: newQueuesObject,
                                        [`book_progress.${nextBookName}`]: 0
                                    };

                                    // Apply queue item settings to book_settings if it's an object
                                    if (typeof nextBookItem === 'object' && nextBookItem.test_mode) {
                                        updates[`book_settings.${nextBookName}.test_mode`] = nextBookItem.test_mode;
                                    }
                                    if (typeof nextBookItem === 'object' && nextBookItem.words_per_session) {
                                        updates[`book_settings.${nextBookName}.words_per_session`] = nextBookItem.words_per_session;
                                    }

                                    // If this was the primary book, update primary book fields
                                    if (userData.book_name === bookName) {
                                        updates.book_name = nextBookName;
                                        updates.current_word_index = 0;
                                    }

                                    await updateDoc(userRef, updates);
                                    alert('교재가 변경되었습니다. 학습을 시작합니다.');
                                    window.location.reload();
                                } else {
                                    navigate('/student');
                                }
                            }, 100);
                        }
                    }
                } catch (err) {
                    console.error("Error auto-transitioning:", err);
                }
            }
        };

        checkAutoTransition();

        return () => {
            isCancelled = true;
        };
    }, [loading, words.length, debugInfo, bookName, navigate, rangeInfo]);

    if (loading) {
        return <div className="p-8 text-center">단어 불러오는 중...</div>;
    }

    if (words.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-gray-800 mb-4">학습할 단어가 없습니다</h1>
                    <p className="text-gray-600 mb-6">
                        모든 단어를 학습했거나 단어장이 비어있습니다.<br />
                        <div className="text-xs text-gray-500 mt-4 text-left bg-gray-100 p-4 rounded overflow-auto max-h-40">
                            <p><strong>디버깅 정보:</strong></p>
                            <p>책 이름: {bookName}</p>
                            <p>요청 범위: {rangeInfo.start} ~ {rangeInfo.end - 1}</p>
                            {debugInfo && (
                                <>
                                    <p>DB 전체 단어 수: {debugInfo.totalWords}</p>
                                    <p>필터링 전 첫 단어: {JSON.stringify(debugInfo.firstWord)}</p>
                                    <p>필터링 전 마지막 단어: {JSON.stringify(debugInfo.lastWord)}</p>
                                </>
                            )}
                        </div>
                    </p>
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
                                <div className="flex-1">
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
                                onClick={() => navigate('/student/game', {
                                    state: {
                                        studyStartIndex: rangeInfo.start,
                                        studyEndIndex: rangeInfo.end,
                                        bookName
                                    }
                                })}
                                className="py-4 bg-green-500 text-white rounded-xl font-bold text-lg hover:bg-green-600 transition-all flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                <span className="text-2xl">🎮</span>
                                <span className="text-sm md:text-base">카드 뒤집기</span>
                            </button>
                            <button
                                onClick={() => navigate('/student/scramble', {
                                    state: {
                                        studyStartIndex: rangeInfo.start,
                                        studyEndIndex: rangeInfo.end,
                                        bookName
                                    }
                                })}
                                className="py-4 bg-yellow-500 text-white rounded-xl font-bold text-lg hover:bg-yellow-600 transition-all flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                <span className="text-2xl">🧩</span>
                                <span className="text-sm md:text-base">단어 조합</span>
                            </button>
                            <button
                                onClick={() => navigate('/student/speed', {
                                    state: {
                                        studyStartIndex: rangeInfo.start,
                                        studyEndIndex: rangeInfo.end,
                                        bookName
                                    }
                                })}
                                className="py-4 bg-pink-500 text-white rounded-xl font-bold text-lg hover:bg-pink-600 transition-all flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                <span className="text-2xl">⚡</span>
                                <span className="text-sm md:text-base">스피드 퀴즈</span>
                            </button>
                            <button
                                onClick={() => navigate('/student/rain', {
                                    state: {
                                        studyStartIndex: rangeInfo.start,
                                        studyEndIndex: rangeInfo.end,
                                        bookName
                                    }
                                })}
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

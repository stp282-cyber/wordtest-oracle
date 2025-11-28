import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, addDays, getDay, getWeekOfMonth } from 'date-fns';
import { LogOut, BookOpen, Calendar as CalendarIcon, CheckCircle, ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

export default function StudentDashboard() {
    const [history, setHistory] = useState([]);
    const [settings, setSettings] = useState(null);
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
    const navigate = useNavigate();
    const username = localStorage.getItem('username');
    const userId = localStorage.getItem('userId');

    // Fetch Dashboard Data
    useEffect(() => {
        const fetchDashboard = async () => {
            if (!userId) return;

            try {
                // Fetch User Settings
                const userRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    let userData = userDoc.data();

                    // Check if student has no active books
                    const hasNoBooks = !userData.active_books || userData.active_books.length === 0;
                    const hasNoBookName = !userData.book_name;

                    if (hasNoBooks && hasNoBookName) {
                        // Find a default book from words collection
                        const wordsQuery = query(collection(db, 'words'), where('book_name', '!=', ''));
                        const querySnapshot = await getDocs(wordsQuery);

                        if (!querySnapshot.empty) {
                            // Get the first available book name
                            const firstWord = querySnapshot.docs[0].data();
                            const defaultBook = firstWord.book_name;

                            if (defaultBook) {
                                // Update user with this default book
                                const updates = {
                                    active_books: [defaultBook],
                                    book_name: defaultBook,
                                    book_settings: {
                                        [defaultBook]: {
                                            test_mode: 'word_typing',
                                            words_per_session: 10
                                        }
                                    }
                                };

                                await updateDoc(userRef, updates);
                                userData = { ...userData, ...updates };
                            }
                        }
                    }

                    setSettings(userData);
                }

                // Fetch History
                const historyQuery = query(
                    collection(db, 'test_results'),
                    where('user_id', '==', userId)
                );
                const querySnapshot = await getDocs(historyQuery);
                const historyData = querySnapshot.docs.map(doc => doc.data());

                // Sort by date desc
                historyData.sort((a, b) => new Date(b.date) - new Date(a.date));
                setHistory(historyData);

            } catch (err) {
                console.error("Error fetching dashboard data:", err);
            }
        };

        fetchDashboard();
    }, [userId]);

    const handleLogout = () => {
        auth.signOut();
        localStorage.clear();
        navigate('/login');
    };

    const isStudyDay = (date) => {
        if (!settings || !settings.study_days) return false;
        const dayOfWeek = getDay(date);
        const studyDays = settings.study_days.split(',').map(d => parseInt(d));
        return studyDays.includes(dayOfWeek);
    };

    const getWordRangeForDate = (date, bookName) => {
        if (!settings || !bookName) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        // Determine currentIndex for this book
        let currentIndex = 0;
        if (settings.book_progress && settings.book_progress[bookName] !== undefined) {
            currentIndex = settings.book_progress[bookName];
        } else if (bookName === settings.book_name) {
            currentIndex = settings.current_word_index || 0;
        }

        const bookSettings = settings.book_settings?.[bookName] || {};
        const bookWordsPerSession = bookSettings.words_per_session ? parseInt(bookSettings.words_per_session) : null;

        const defaultWordsPerSession = settings.words_per_session || 10;
        const dailyCounts = settings.words_per_day || {};

        const getWordsForDay = (dayStr) => {
            if (bookWordsPerSession) return bookWordsPerSession;
            if (dailyCounts[dayStr]) return parseInt(dailyCounts[dayStr]);
            return defaultWordsPerSession;
        };

        // Check if there is a history record for this date and book
        const historyRecord = history.find(h => {
            const recordDate = h.scheduled_date ? new Date(h.scheduled_date) : new Date(h.date);
            const isSameDate = isSameDay(recordDate, targetDate);
            const historyBook = h.book_name || settings.book_name;
            return isSameDate && historyBook === bookName;
        });

        if (historyRecord && historyRecord.range_start && historyRecord.range_end) {
            return { start: historyRecord.range_start, end: historyRecord.range_end };
        }

        // Helper to check if a specific day was completed for THIS book
        const isDayCompleted = (dayToCheck) => {
            return history.some(h => {
                const recordDate = h.scheduled_date ? new Date(h.scheduled_date) : new Date(h.date);
                const isSameDate = isSameDay(recordDate, dayToCheck);
                const historyBook = h.book_name || settings.book_name;
                return isSameDate && historyBook === bookName;
            });
        };

        const todayCompleted = isDayCompleted(today);

        let accumulatedWords = 0;

        if (targetDate < today) {
            // Past Logic: Calculate backwards from currentIndex
            let d = new Date(today);
            // If today is NOT completed, currentIndex reflects Yesterday's end. So we start from Yesterday.
            if (!todayCompleted) {
                d.setDate(d.getDate() - 1);
            }

            // Loop backwards until we reach the day AFTER targetDate
            while (d > targetDate) {
                if (isStudyDay(d)) {
                    accumulatedWords -= getWordsForDay(getDay(d).toString());
                }
                d.setDate(d.getDate() - 1);
            }

        } else if (targetDate > today) {
            // Future Logic: Calculate forwards from currentIndex
            let d = new Date(today);
            // If today is completed, Tomorrow is the next session.
            if (todayCompleted) {
                d.setDate(d.getDate() + 1);
            }

            while (d < targetDate) {
                if (isStudyDay(d)) {
                    accumulatedWords += getWordsForDay(getDay(d).toString());
                }
                d.setDate(d.getDate() + 1);
            }
        }

        const targetDayOfWeek = getDay(targetDate).toString();
        const wordsForTargetDay = getWordsForDay(targetDayOfWeek);

        let startWordNumber, endWordNumber;

        if (targetDate < today) {
            const targetEndIndex = currentIndex + accumulatedWords;
            startWordNumber = targetEndIndex - wordsForTargetDay + 1;
            endWordNumber = startWordNumber + wordsForTargetDay;
        } else {
            // Future or Today
            const baseWordNumber = currentIndex;
            startWordNumber = baseWordNumber + accumulatedWords + 1;
            endWordNumber = startWordNumber + wordsForTargetDay;
        }

        if (startWordNumber <= 0) return null;

        return { start: startWordNumber, end: endWordNumber };
    };

    const handleStartStudy = (date, bookName, range) => {
        if (range) {
            navigate('/student/study', {
                state: {
                    studyStartIndex: range.start,
                    studyEndIndex: range.end,
                    scheduledDate: date.toISOString(),
                    bookName: bookName
                }
            });
        } else {
            navigate('/student/study', {
                state: {
                    scheduledDate: date.toISOString(),
                    bookName: bookName
                }
            });
        }
    };

    const handlePrevWeek = () => {
        setCurrentWeekStart(prev => subWeeks(prev, 1));
    };

    const handleNextWeek = () => {
        setCurrentWeekStart(prev => addWeeks(prev, 1));
    };

    // Generate days for the table
    const weekDays = [];
    let d = new Date(currentWeekStart);
    for (let i = 0; i < 7; i++) {
        weekDays.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }

    const studyDays = weekDays.filter(day => isStudyDay(day));
    const activeBooks = (settings?.active_books || (settings?.book_name ? [settings.book_name] : []))
        .filter(book => book !== '기본');

    // Calculate reference date (Thursday) for correct Month/Week display
    const referenceDate = addDays(currentWeekStart, 4);

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-4xl px-4 py-4 mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <CalendarIcon className="w-6 h-6 text-indigo-600" />
                        <h1 className="text-xl font-bold text-gray-800">나의 학습 계획</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="text-gray-600">안녕하세요, <b>{localStorage.getItem('name') || username}</b>님</span>
                        <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 transition-colors">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>
            <div className="flex justify-center mb-6">
                <button
                    onClick={() => navigate('/student/history')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    내 학습 기록 보기
                </button>
            </div>

            <main className="max-w-7xl px-4 py-8 mx-auto space-y-8">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <button onClick={handlePrevWeek} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <h2 className="text-xl font-bold text-gray-800">
                                {format(referenceDate, 'yyyy년 M월')} {getWeekOfMonth(referenceDate, { weekStartsOn: 0 })}주차 학습 계획
                            </h2>
                            <button onClick={handleNextWeek} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <span className="flex items-center"><div className="w-3 h-3 bg-green-500 rounded-full mr-1"></div>완료</span>
                            <span className="flex items-center"><div className="w-3 h-3 bg-red-500 rounded-full mr-1"></div>미완료</span>
                            <span className="flex items-center"><div className="w-3 h-3 bg-blue-400 rounded-full mr-1"></div>예정</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 w-48 sticky left-0 bg-gray-50 z-10">교재명</th>
                                    {studyDays.map((date, i) => (
                                        <th key={i} className="px-6 py-4 text-center text-sm font-semibold text-gray-600 border-l border-gray-200">
                                            <div className="flex flex-col items-center">
                                                <span>{format(date, 'M/d')} ({['일', '월', '화', '수', '목', '금', '토'][getDay(date)]})</span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {activeBooks.map((book) => (
                                    <tr key={book} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-6 text-sm font-bold text-gray-800 sticky left-0 bg-white z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                            {book}
                                        </td>
                                        {studyDays.map((date, i) => {
                                            const isDone = history.some(h => {
                                                const recordDate = h.scheduled_date ? new Date(h.scheduled_date) : new Date(h.date);
                                                const isSameDate = isSameDay(recordDate, date);
                                                const historyBook = h.book_name || settings.book_name;
                                                return isSameDate && historyBook === book;
                                            });

                                            const range = getWordRangeForDate(date, book);
                                            const isTodayFlag = isSameDay(date, new Date());
                                            const isPast = date < new Date().setHours(0, 0, 0, 0);

                                            return (
                                                <td key={i} className="px-4 py-4 border-l border-gray-100 align-top">
                                                    <div className="flex flex-col items-center space-y-3">
                                                        {range && (
                                                            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                                                단어 {range.start} ~ {range.end - 1}
                                                            </span>
                                                        )}

                                                        {isDone ? (
                                                            <button
                                                                onClick={() => handleStartStudy(date, book, range)}
                                                                className="flex flex-col items-center w-full hover:bg-gray-50 rounded-lg p-1 transition-colors group"
                                                            >
                                                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-medium mb-2 group-hover:bg-green-200 group-hover:text-green-800 transition-colors">완료됨 (재학습)</span>
                                                                <div className="text-xs text-gray-400">
                                                                    {history.find(h => {
                                                                        const recordDate = h.scheduled_date ? new Date(h.scheduled_date) : new Date(h.date);
                                                                        const historyBook = h.book_name || settings.book_name;
                                                                        return isSameDay(recordDate, date) && historyBook === book;
                                                                    })?.date.split('T')[0]}
                                                                </div>
                                                            </button>
                                                        ) : (
                                                            range ? (
                                                                <div className="flex flex-col items-center w-full">
                                                                    <div className={`text-xs font-medium mb-2 ${isPast ? 'text-red-500' : 'text-blue-500'}`}>
                                                                        {isPast ? '미완료' : '학습 예정'}
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleStartStudy(date, book, range)}
                                                                        className={`
                                                                            w-full py-2 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center space-x-1
                                                                            ${isPast
                                                                                ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm'
                                                                                : (isTodayFlag
                                                                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md animate-pulse'
                                                                                    : 'bg-blue-100 text-blue-600 hover:bg-blue-200')
                                                                            }
                                                                        `}
                                                                    >
                                                                        {isPast || isTodayFlag ? '학습하기' : '대기'}
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-gray-300 mt-4">-</div>
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                {activeBooks.length === 0 && (
                                    <tr>
                                        <td colSpan={studyDays.length + 1} className="px-6 py-12 text-center text-gray-500">
                                            등록된 학습 교재가 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-800">
                        <span className="font-semibold">학습 안내:</span> 각 교재별로 지정된 요일에 학습을 진행하세요. 지난 학습도 언제든지 다시 할 수 있습니다.
                    </p>
                </div>
            </main>
        </div>
    );
}

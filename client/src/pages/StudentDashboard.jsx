import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, getDay, addMonths, subMonths } from 'date-fns';
import { LogOut, BookOpen, Calendar as CalendarIcon, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export default function StudentDashboard() {
    const [history, setHistory] = useState([]);
    const [settings, setSettings] = useState(null);
    const [todayCompleted, setTodayCompleted] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedBook, setSelectedBook] = useState(null);
    const navigate = useNavigate();
    const username = localStorage.getItem('username');

    useEffect(() => {
        const fetchDashboard = async () => {
            const userId = localStorage.getItem('userId');
            if (!userId) return;

            try {
                // Fetch User Settings
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                    setSettings(userDoc.data());
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

                const today = new Date();
                const completedToday = historyData.some(h => {
                    const historyDate = new Date(h.date);
                    return isSameDay(historyDate, today);
                });
                setTodayCompleted(completedToday);

            } catch (err) {
                console.error("Error fetching dashboard data:", err);
            }
        };

        fetchDashboard();
    }, []);

    useEffect(() => {
        if (settings) {
            const books = settings.active_books || (settings.book_name ? [settings.book_name] : []);
            if (books.length > 0 && !selectedBook) {
                setSelectedBook(books[0]);
            }
        }
    }, [settings, selectedBook]);
    // eslint-disable-next-line react-hooks/exhaustive-deps

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

    const getWordRangeForDate = (date, bookName = selectedBook) => {
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
        const defaultWordsPerSession = bookSettings.words_per_session || settings.words_per_session || 10;
        const dailyCounts = settings.words_per_day || {};

        // Helper to check if a specific day was completed for THIS book
        const isDayCompleted = (dayToCheck) => {
            return history.some(h => {
                const recordDate = h.scheduled_date ? new Date(h.scheduled_date) : new Date(h.date);
                const isSameDate = isSameDay(recordDate, dayToCheck);
                // Legacy compatibility: if h.book_name is missing, assume it matches settings.book_name
                const historyBook = h.book_name || settings.book_name;
                return isSameDate && historyBook === bookName;
            });
        };

        const todayCompleted = isDayCompleted(today);

        let accumulatedWords = 0;

        if (targetDate < today) {
            const daysInRange = eachDayOfInterval({
                start: targetDate,
                end: new Date(today.getTime() - 24 * 60 * 60 * 1000)
            });

            for (const day of daysInRange) {
                if (isDayCompleted(day)) {
                    const dayOfWeek = getDay(day).toString();
                    const wordsForThisDay = dailyCounts[dayOfWeek] ? parseInt(dailyCounts[dayOfWeek]) : defaultWordsPerSession;
                    accumulatedWords -= wordsForThisDay;
                }
            }
        } else if (targetDate > today) {
            if (!todayCompleted && isStudyDay(today)) {
                const todayOfWeek = getDay(today).toString();
                const wordsForToday = dailyCounts[todayOfWeek] ? parseInt(dailyCounts[todayOfWeek]) : defaultWordsPerSession;
                accumulatedWords += wordsForToday;
            }

            if (targetDate > new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
                const interimDays = eachDayOfInterval({
                    start: new Date(today.getTime() + 24 * 60 * 60 * 1000),
                    end: new Date(targetDate.getTime() - 24 * 60 * 60 * 1000)
                });

                for (const day of interimDays) {
                    if (isStudyDay(day)) {
                        const dayOfWeek = getDay(day).toString();
                        const wordsForThisDay = dailyCounts[dayOfWeek] ? parseInt(dailyCounts[dayOfWeek]) : defaultWordsPerSession;
                        accumulatedWords += wordsForThisDay;
                    }
                }
            }
        } else {
            // Target is today
            accumulatedWords = 0;
        }

        const targetDayOfWeek = getDay(targetDate).toString();
        const wordsForTargetDay = bookSettings.words_per_session
            ? bookSettings.words_per_session
            : (dailyCounts[targetDayOfWeek] ? parseInt(dailyCounts[targetDayOfWeek]) : defaultWordsPerSession);

        const baseWordNumber = currentIndex;
        const startWordNumber = baseWordNumber + accumulatedWords;
        const endWordNumber = startWordNumber + wordsForTargetDay;

        return { start: startWordNumber, end: endWordNumber };
    };

    const handleStartStudy = (date) => {
        const wordRange = getWordRangeForDate(date);
        if (wordRange) {
            navigate('/student/study', {
                state: {
                    studyStartIndex: wordRange.start,
                    studyEndIndex: wordRange.end,
                    scheduledDate: date.toISOString(),
                    bookName: selectedBook
                }
            });
        } else {
            navigate('/student/study', {
                state: {
                    scheduledDate: date.toISOString()
                }
            });
        }
    };

    const handlePrevMonth = () => {
        setCurrentMonth(prev => subMonths(prev, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(prev => addMonths(prev, 1));
    };

    const monthStart = startOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({
        start: monthStart,
        end: endOfMonth(currentMonth)
    });

    const getDayStatus = (date) => {
        const isStudyDayFlag = isStudyDay(date);
        const studied = history.some(h => {
            const historyDate = new Date(h.date);
            const scheduledDate = h.scheduled_date ? new Date(h.scheduled_date) : null;
            return isSameDay(historyDate, date) || (scheduledDate && isSameDay(scheduledDate, date));
        });
        const isTodayFlag = isToday(date);
        const isPast = date < new Date().setHours(0, 0, 0, 0);
        const wordRange = getWordRangeForDate(date);

        if (studied) {
            return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', clickable: true, showInfo: true, wordRange, isToday: isTodayFlag };
        }
        if (isTodayFlag && isStudyDayFlag) {
            return { bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-500', clickable: true, showInfo: true, isToday: true, wordRange };
        }
        if (isTodayFlag && !isStudyDayFlag) {
            return { bg: 'bg-white', text: 'text-indigo-900', border: 'border-indigo-600 ring-2 ring-indigo-100', clickable: false, showInfo: false, isToday: true, wordRange: null };
        }
        if (isStudyDayFlag && isPast) {
            return { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', clickable: true, showInfo: true, wordRange, isToday: isTodayFlag };
        }
        if (isStudyDayFlag) {
            return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', clickable: true, showInfo: true, wordRange, isToday: isTodayFlag };
        }
        // Non-study days are NOT clickable
        return { bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-100', clickable: false, showInfo: false, wordRange: null, isToday: isTodayFlag };
    };

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

            <main className="max-w-4xl px-4 py-8 mx-auto space-y-8">
                <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                    {/* Book Tabs */}
                    {settings?.active_books && settings.active_books.length > 0 && (
                        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
                            {settings.active_books.map(book => (
                                <button
                                    key={book}
                                    onClick={() => setSelectedBook(book)}
                                    className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all font-medium ${selectedBook === book
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {book}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">학습 진도</h2>
                            <p className="text-sm text-gray-500">단어장: {selectedBook || settings?.book_name || '기본'}</p>
                            <p className="text-sm text-gray-500">
                                현재 단어 번호: {
                                    settings?.book_progress?.[selectedBook] !== undefined
                                        ? settings.book_progress[selectedBook]
                                        : (selectedBook === settings?.book_name ? settings?.current_word_index : 0) || 0
                                }
                            </p>
                        </div>
                        {todayCompleted && (
                            <div className="flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-medium">오늘 학습 완료</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-4">
                            <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <h2 className="text-lg font-semibold text-gray-800">{format(currentMonth, 'yyyy년 M월')}</h2>
                            <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                        <div className="flex items-center space-x-4 text-xs">
                            <div className="flex items-center space-x-1">
                                <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                                <span className="text-gray-600">완료</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <div className="w-3 h-3 bg-indigo-100 border border-indigo-300 rounded"></div>
                                <span className="text-gray-600">오늘</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <div className="w-3 h-3 bg-red-50 border border-red-200 rounded"></div>
                                <span className="text-gray-600">미완료</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div>
                                <span className="text-gray-600">예정</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                            <div key={day} className="text-center text-xs font-medium text-gray-400 py-2">
                                {day}
                            </div>
                        ))}
                        {Array.from({ length: getDay(monthStart) }).map((_, i) => (
                            <div key={`empty-${i}`} className="min-h-[80px]"></div>
                        ))}
                        {daysInMonth.map((date, i) => {
                            const status = getDayStatus(date);
                            const studied = history.some(h => isSameDay(new Date(h.date), date));

                            return (
                                <button
                                    key={i}
                                    onClick={() => status.clickable && handleStartStudy(date)}
                                    disabled={!status.clickable}
                                    className={`
                                            min-h-[80px] p-2 flex flex-col items-center justify-start rounded-lg border
                                            ${status.bg} ${status.text} ${status.border}
                                            ${status.clickable ? 'cursor-pointer hover:shadow-lg hover:scale-105 transition-all' : 'cursor-not-allowed opacity-60'}
                                            ${status.isToday ? 'ring-4 ring-indigo-300 shadow-xl' : ''}
                                        `}
                                >
                                    <div className={`font-semibold mb-1 ${status.isToday ? 'text-lg' : ''}`}>
                                        {format(date, 'd')}
                                        {status.isToday && <div className="text-[8px] font-normal">오늘</div>}
                                    </div>
                                    {status.showInfo && status.wordRange && (
                                        <div className="text-[10px] text-center leading-tight">
                                            <div className="font-medium">{selectedBook || settings?.book_name || '기본'}</div>
                                            <div>#{status.wordRange.start} - #{status.wordRange.end - 1}</div>
                                        </div>
                                    )}
                                    {status.clickable && !studied && (
                                        <div className="mt-auto">
                                            <BookOpen className={`w-4 h-4 ${status.isToday ? 'animate-pulse' : ''}`} />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-800">
                        <span className="font-semibold">학습 요일:</span> {
                            settings?.study_days?.split(',').map(d => {
                                const days = ['일', '월', '화', '수', '목', '금', '토'];
                                return days[parseInt(d)];
                            }).join(', ')
                        }
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                        달력에서 학습 가능한 날짜를 클릭하여 학습을 시작하세요.
                    </p>
                </div>
            </main>
        </div>
    );
}

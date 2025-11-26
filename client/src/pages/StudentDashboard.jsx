import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, getDay } from 'date-fns';
import { LogOut, BookOpen, Calendar as CalendarIcon, CheckCircle } from 'lucide-react';

export default function StudentDashboard() {
    const [history, setHistory] = useState([]);
    const [settings, setSettings] = useState(null);
    const [todayCompleted, setTodayCompleted] = useState(false);
    const navigate = useNavigate();
    const username = localStorage.getItem('username');

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        const userId = localStorage.getItem('userId');
        try {
            const res = await fetch('http://localhost:5000/api/student/dashboard', {
                headers: { 'x-user-id': userId }
            });
            const data = await res.json();
            if (res.ok) {
                setHistory(data.history);
                setSettings(data.settings);

                const today = new Date();
                const completedToday = data.history.some(h => {
                    const historyDate = new Date(h.date);
                    return isSameDay(historyDate, today);
                });
                setTodayCompleted(completedToday);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const handleStartStudy = (date) => {
        if (!isStudyDay(date)) {
            alert('오늘은 학습 요일이 아닙니다.');
            return;
        }

        const completed = history.some(h => isSameDay(new Date(h.date), date));
        if (completed) {
            alert('이미 학습을 완료했습니다!');
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        // Calculate word range for the selected date
        const wordRange = getWordRangeForDate(date);

        // If clicking today, use current_word_index (don't store in localStorage)
        if (targetDate.getTime() === today.getTime()) {
            localStorage.removeItem('studyStartIndex');
            localStorage.removeItem('studyEndIndex');
        } else if (wordRange) {
            // For other dates, store the calculated range
            // Note: current_word_index is 0-based count, but wordRange.start is already 1-based word_number
            // We need to convert it back to 0-based count for the backend
            localStorage.setItem('studyStartIndex', (wordRange.start - 1).toString());
            localStorage.setItem('studyEndIndex', (wordRange.end - 1).toString());
        }

        navigate('/student/study');
    };

    const isStudyDay = (date) => {
        if (!settings || !settings.study_days) return false;
        const dayOfWeek = getDay(date);
        const studyDays = settings.study_days.split(',').map(d => parseInt(d));
        return studyDays.includes(dayOfWeek);
    };

    // Calculate word range for a specific date based on current_word_index
    const getWordRangeForDate = (date) => {
        if (!settings) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        // current_word_index is 0-based count (number of completed words)
        const currentIndex = settings.current_word_index || 0;
        const wordsPerSession = settings.words_per_session || 10;

        // Check if today is completed
        const todayCompleted = history.some(h => isSameDay(new Date(h.date), today));

        // Count study days between today and target date
        let daysDifference = 0;

        if (targetDate < today) {
            // For past dates, count backwards (how many uncompleted study days)
            const daysInRange = eachDayOfInterval({
                start: targetDate,
                end: new Date(today.getTime() - 24 * 60 * 60 * 1000)
            });

            for (const day of daysInRange) {
                if (isStudyDay(day) && !history.some(h => isSameDay(new Date(h.date), day))) {
                    daysDifference--;
                }
            }
        } else if (targetDate > today) {
            // For future dates, count forwards
            // If today is not completed, start counting from today
            if (!todayCompleted && isStudyDay(today)) {
                daysDifference = 0; // Today uses current index
            }

            const daysInRange = eachDayOfInterval({
                start: todayCompleted ? new Date(today.getTime() + 24 * 60 * 60 * 1000) : today,
                end: targetDate
            });

            for (const day of daysInRange) {
                if (day > today && isStudyDay(day)) {
                    daysDifference++;
                }
            }
        } else {
            // targetDate === today
            daysDifference = 0;
        }

        // Calculate word_number range (1-based)
        // currentIndex is 0-based count, so next word to study is currentIndex + 1
        const baseWordNumber = currentIndex + 1;
        const startWordNumber = baseWordNumber + (daysDifference * wordsPerSession);
        const endWordNumber = startWordNumber + wordsPerSession;

        return { start: startWordNumber, end: endWordNumber };
    };

    const today = new Date();
    const monthStart = startOfMonth(today);
    const daysInMonth = eachDayOfInterval({
        start: monthStart,
        end: endOfMonth(today)
    });

    const getDayStatus = (date) => {
        const isStudyDayFlag = isStudyDay(date);
        const studied = history.some(h => isSameDay(new Date(h.date), date));
        const isTodayFlag = isToday(date);
        const isPast = date < new Date().setHours(0, 0, 0, 0);
        const wordRange = getWordRangeForDate(date);

        if (studied) {
            return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', clickable: false, showInfo: true, wordRange };
        }
        if (isTodayFlag && isStudyDayFlag) {
            return { bg: 'bg-gradient-to-br from-indigo-500 to-purple-600', text: 'text-white', border: 'border-indigo-600', clickable: true, showInfo: true, isToday: true, wordRange };
        }
        if (isStudyDayFlag && isPast) {
            return { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', clickable: true, showInfo: true, wordRange };
        }
        if (isStudyDayFlag) {
            return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', clickable: true, showInfo: true, wordRange };
        }
        return { bg: 'bg-gray-50', text: 'text-gray-300', border: 'border-gray-100', clickable: false, showInfo: false, wordRange: null };
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
                        <span className="text-gray-600">안녕하세요, <b>{username}</b>님</span>
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
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800">학습 진도</h2>
                            <p className="text-sm text-gray-500">단어장: {settings?.book_name || '기본'}</p>
                            <p className="text-sm text-gray-500">현재 단어 번호: {settings?.current_word_index || 0}</p>
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
                        <h2 className="text-lg font-semibold text-gray-800">{format(today, 'yyyy년 M월')}</h2>
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
                                        <div className={`text-[10px] text-center leading-tight ${status.isToday ? 'text-white' : ''}`}>
                                            <div className="font-medium">{settings?.book_name || '기본'}</div>
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

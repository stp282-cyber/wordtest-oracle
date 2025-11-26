import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Settings, Calendar } from 'lucide-react';

export default function StudentManagement() {
    const [students, setStudents] = useState([]);
    const [books, setBooks] = useState([]);
    const [classes, setClasses] = useState([]);
    const [newStudent, setNewStudent] = useState({ username: '', password: '', name: '' });
    const [editingStudent, setEditingStudent] = useState(null);

    const weekDays = [
        { value: '0', label: '일' },
        { value: '1', label: '월' },
        { value: '2', label: '화' },
        { value: '3', label: '수' },
        { value: '4', label: '목' },
        { value: '5', label: '금' },
        { value: '6', label: '토' }
    ];

    useEffect(() => {
        fetchStudents();
        fetchBooks();
        fetchClasses();
    }, []);

    const fetchStudents = async () => {
        const res = await fetch('http://localhost:5000/api/admin/students');
        const data = await res.json();
        setStudents(data);
    };

    const fetchBooks = async () => {
        const res = await fetch('http://localhost:5000/api/admin/words');
        const data = await res.json();
        const uniqueBooks = [...new Set(data.map(w => w.book_name).filter(Boolean))];
        setBooks(uniqueBooks);
    };

    const fetchClasses = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/admin/classes');
            const data = await res.json();
            if (res.ok) setClasses(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdateClass = async (studentId, classId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/admin/students/${studentId}/class`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ class_id: classId || null })
            });

            if (res.ok) {
                // Update local state immediately for better UX
                setStudents(students.map(s =>
                    s.id === studentId
                        ? { ...s, class_id: classId, class_name: classes.find(c => c.id == classId)?.name }
                        : s
                ));
            } else {
                alert('반 배정 실패');
            }
        } catch (err) {
            console.error(err);
            alert('서버 오류');
        }
    };

    const handleRegisterStudent = async (e) => {
        e.preventDefault();
        if (!newStudent.username || !newStudent.password) {
            alert('아이디와 비밀번호를 입력해주세요.');
            return;
        }

        try {
            const res = await fetch('http://localhost:5000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: newStudent.username,
                    password: newStudent.password,
                    name: newStudent.name,
                    role: 'student'
                })
            });

            const data = await res.json();
            if (data.success) {
                alert('학생이 등록되었습니다!');
                setNewStudent({ username: '', password: '', name: '' });
                fetchStudents();
            } else {
                alert('등록 실패: ' + (data.error || '알 수 없는 오류'));
            }
        } catch (err) {
            alert('등록 실패: ' + err.message);
        }
    };

    const handleUpdateSettings = async (student) => {
        try {
            const res = await fetch(`http://localhost:5000/api/admin/students/${student.id}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    book_name: student.book_name,
                    study_days: student.study_days,
                    words_per_session: student.words_per_session,
                    current_word_index: student.current_word_index
                })
            });

            if (res.ok) {
                alert('설정이 업데이트되었습니다!');
                setEditingStudent(null);
                fetchStudents();
            }
        } catch (err) {
            alert('업데이트 실패: ' + err.message);
        }
    };

    const handleDeleteStudent = async (userId) => {
        if (!confirm('이 학생을 삭제하시겠습니까?')) return;

        try {
            const res = await fetch(`http://localhost:5000/api/admin/students/${userId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                alert('학생이 삭제되었습니다.');
                fetchStudents();
            }
        } catch (err) {
            alert('삭제 실패: ' + err.message);
        }
    };

    const toggleStudyDay = (student, day) => {
        const currentDays = (student.study_days || '1,2,3,4,5').split(',');
        const newDays = currentDays.includes(day)
            ? currentDays.filter(d => d !== day)
            : [...currentDays, day].sort();

        setStudents(students.map(s =>
            s.id === student.id
                ? { ...s, study_days: newDays.join(',') }
                : s
        ));
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-3 bg-indigo-600 rounded-lg">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">학생 관리</h1>
                    </div>
                </header>

                {/* Student Registration */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4 flex items-center">
                        <UserPlus className="w-5 h-5 mr-2 text-gray-500" />
                        학생 등록
                    </h2>
                    <form onSubmit={handleRegisterStudent} className="flex gap-4">
                        <input
                            type="text"
                            placeholder="학생 아이디"
                            value={newStudent.username}
                            onChange={(e) => setNewStudent({ ...newStudent, username: e.target.value })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <input
                            type="text"
                            placeholder="학생 이름"
                            value={newStudent.name}
                            onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <input
                            type="password"
                            placeholder="비밀번호"
                            value={newStudent.password}
                            onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button
                            type="submit"
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all flex items-center space-x-2"
                        >
                            <UserPlus className="w-5 h-5" />
                            <span>등록</span>
                        </button>
                    </form>
                </div>

                {/* Student List */}
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4">학생 목록 ({students.length}명)</h2>
                    <div className="space-y-4">
                        {students.map((student) => (
                            <div key={student.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{student.name || student.username}</h3>
                                        <p className="text-sm text-gray-500">ID: {student.username}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {editingStudent === student.id ? (
                                            <>
                                                <button
                                                    onClick={() => handleUpdateSettings(student)}
                                                    className="px-4 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                                                >
                                                    저장
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingStudent(null);
                                                        fetchStudents();
                                                    }}
                                                    className="px-4 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500"
                                                >
                                                    취소
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => setEditingStudent(student.id)}
                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="설정 수정"
                                            >
                                                <Settings className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteStudent(student.id)}
                                            className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
                                        >
                                            삭제
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Class Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">반 배정</label>
                                        {editingStudent === student.id ? (
                                            <select
                                                value={student.class_id || ''}
                                                onChange={(e) => handleUpdateClass(student.id, e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            >
                                                <option value="">반 선택 안함</option>
                                                {classes.map(cls => (
                                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <p className="text-gray-600 py-2">{student.class_name || '미배정'}</p>
                                        )}
                                    </div>

                                    {/* Book Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">단어장</label>
                                        {editingStudent === student.id ? (
                                            <select
                                                value={student.book_name || '기본'}
                                                onChange={(e) => setStudents(students.map(s =>
                                                    s.id === student.id ? { ...s, book_name: e.target.value } : s
                                                ))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            >
                                                {books.map(book => (
                                                    <option key={book} value={book}>{book}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <p className="text-gray-600 py-2">{student.book_name || '기본'}</p>
                                        )}
                                    </div>

                                    {/* Current Word Index */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">현재 진행 단어 번호</label>
                                        {editingStudent === student.id ? (
                                            <input
                                                type="number"
                                                value={student.current_word_index || 0}
                                                onChange={(e) => setStudents(students.map(s =>
                                                    s.id === student.id ? { ...s, current_word_index: parseInt(e.target.value) } : s
                                                ))}
                                                min="0"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        ) : (
                                            <p className="text-gray-600 py-2">{student.current_word_index || 0}번</p>
                                        )}
                                    </div>

                                    {/* Words Per Session */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">세션당 단어 수</label>
                                        {editingStudent === student.id ? (
                                            <input
                                                type="number"
                                                value={student.words_per_session || 10}
                                                onChange={(e) => setStudents(students.map(s =>
                                                    s.id === student.id ? { ...s, words_per_session: parseInt(e.target.value) } : s
                                                ))}
                                                min="1"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        ) : (
                                            <p className="text-gray-600 py-2">{student.words_per_session || 10}개</p>
                                        )}
                                    </div>
                                </div>

                                {/* Study Days */}
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                        <Calendar className="w-4 h-4 mr-1" />
                                        학습 요일
                                    </label>
                                    <div className="flex gap-2">
                                        {weekDays.map(day => {
                                            const isSelected = (student.study_days || '1,2,3,4,5').split(',').includes(day.value);
                                            return (
                                                <button
                                                    key={day.value}
                                                    onClick={() => editingStudent === student.id && toggleStudyDay(student, day.value)}
                                                    disabled={editingStudent !== student.id}
                                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${isSelected
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-gray-100 text-gray-600'
                                                        } ${editingStudent === student.id ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                                                >
                                                    {day.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {students.length === 0 && (
                            <p className="text-center text-gray-400 py-8">등록된 학생이 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

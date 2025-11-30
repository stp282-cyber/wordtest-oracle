import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, Trash2, Edit } from 'lucide-react';
import { getStudents, addStudent, updateStudent, deleteStudent } from '../api/client';

export default function StudentManagement() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [formData, setFormData] = useState({
        id: '',
        username: '',
        email: '',
        password: '1234'
    });
    const navigate = useNavigate();

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            const data = await getStudents();
            setStudents(data);
        } catch (err) {
            console.error('학생 목록 조회 실패:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingStudent) {
                await updateStudent(editingStudent.ID || editingStudent.id, {
                    username: formData.username,
                    email: formData.email
                });
            } else {
                await addStudent(formData);
            }
            setShowAddModal(false);
            setEditingStudent(null);
            setFormData({ id: '', username: '', email: '', password: '1234' });
            fetchStudents();
        } catch (err) {
            console.error('학생 저장 실패:', err);
            alert('학생 정보 저장에 실패했습니다.');
        }
    };

    const handleEdit = (student) => {
        setEditingStudent(student);
        setFormData({
            id: student.ID || student.id,
            username: student.USERNAME || student.username,
            email: student.EMAIL || student.email,
            password: ''
        });
        setShowAddModal(true);
    };

    const handleDelete = async (studentId) => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return;

        try {
            await deleteStudent(studentId);
            fetchStudents();
        } catch (err) {
            console.error('학생 삭제 실패:', err);
            alert('학생 삭제에 실패했습니다.');
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-3">
                        <Users className="w-8 h-8 text-indigo-600" />
                        <h1 className="text-3xl font-bold text-gray-800">학생 관리</h1>
                    </div>
                    <button
                        onClick={() => {
                            setEditingStudent(null);
                            setFormData({ id: '', username: '', email: '', password: '1234' });
                            setShowAddModal(true);
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
                    >
                        <UserPlus className="w-5 h-5" />
                        <span>학생 추가</span>
                    </button>
                </div>

                {/* Students Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {students.map((student) => (
                                <tr key={student.ID || student.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900">{student.ID || student.id}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{student.USERNAME || student.username}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{student.EMAIL || student.email}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{student.ROLE || student.role}</td>
                                    <td className="px-6 py-4 text-right text-sm space-x-2">
                                        <button
                                            onClick={() => handleEdit(student)}
                                            className="text-indigo-600 hover:text-indigo-900"
                                        >
                                            <Edit className="w-5 h-5 inline" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(student.ID || student.id)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            <Trash2 className="w-5 h-5 inline" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Add/Edit Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-8 max-w-md w-full">
                            <h2 className="text-2xl font-bold mb-6">
                                {editingStudent ? '학생 수정' : '학생 추가'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {!editingStudent && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.id}
                                            onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                {!editingStudent && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                                        <input
                                            type="text"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                )}
                                <div className="flex space-x-3 pt-4">
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                    >
                                        {editingStudent ? '수정' : '추가'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddModal(false);
                                            setEditingStudent(null);
                                        }}
                                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                    >
                                        취소
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

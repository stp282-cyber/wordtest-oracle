import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Edit, Trash2 } from 'lucide-react';
import { getAllWords, addWord, updateWord, deleteWord } from '../api/client';

export default function WordManagement() {
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingWord, setEditingWord] = useState(null);
    const [formData, setFormData] = useState({
        english: '',
        korean: '',
        level_group: 1
    });

    useEffect(() => {
        fetchWords();
    }, []);

    const fetchWords = async () => {
        try {
            const data = await getAllWords();
            setWords(data);
        } catch (err) {
            console.error('단어 목록 조회 실패:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingWord) {
                await updateWord(editingWord.ID || editingWord.id, formData);
            } else {
                await addWord(formData);
            }
            setShowModal(false);
            setEditingWord(null);
            setFormData({ english: '', korean: '', level_group: 1 });
            fetchWords();
        } catch (err) {
            console.error('단어 저장 실패:', err);
            alert('단어 저장에 실패했습니다.');
        }
    };

    const handleEdit = (word) => {
        setEditingWord(word);
        setFormData({
            english: word.ENGLISH || word.english,
            korean: word.KOREAN || word.korean,
            level_group: word.LEVEL_GROUP || word.level_group || 1
        });
        setShowModal(true);
    };

    const handleDelete = async (wordId) => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return;

        try {
            await deleteWord(wordId);
            fetchWords();
        } catch (err) {
            console.error('단어 삭제 실패:', err);
            alert('단어 삭제에 실패했습니다.');
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
                        <BookOpen className="w-8 h-8 text-indigo-600" />
                        <h1 className="text-3xl font-bold text-gray-800">단어 관리</h1>
                        <span className="text-gray-500">({words.length}개)</span>
                    </div>
                    <button
                        onClick={() => {
                            setEditingWord(null);
                            setFormData({ english: '', korean: '', level_group: 1 });
                            setShowModal(true);
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
                    >
                        <Plus className="w-5 h-5" />
                        <span>단어 추가</span>
                    </button>
                </div>

                {/* Words Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">English</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">한글</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {words.map((word) => (
                                <tr key={word.ID || word.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900">{word.ID || word.id}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{word.ENGLISH || word.english}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{word.KOREAN || word.korean}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{word.LEVEL_GROUP || word.level_group}</td>
                                    <td className="px-6 py-4 text-right text-sm space-x-2">
                                        <button
                                            onClick={() => handleEdit(word)}
                                            className="text-indigo-600 hover:text-indigo-900"
                                        >
                                            <Edit className="w-5 h-5 inline" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(word.ID || word.id)}
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
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-8 max-w-md w-full">
                            <h2 className="text-2xl font-bold mb-6">
                                {editingWord ? '단어 수정' : '단어 추가'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">English</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.english}
                                        onChange={(e) => setFormData({ ...formData, english: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">한글 뜻</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.korean}
                                        onChange={(e) => setFormData({ ...formData, korean: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.level_group}
                                        onChange={(e) => setFormData({ ...formData, level_group: parseInt(e.target.value) })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="flex space-x-3 pt-4">
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                    >
                                        {editingWord ? '수정' : '추가'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowModal(false);
                                            setEditingWord(null);
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

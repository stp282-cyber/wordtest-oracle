import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Plus, Edit, Trash2, Upload, Download, FileDown } from 'lucide-react';
import { getAllWords, addWord, updateWord, deleteWord, deleteWordsByBook } from '../api/client';
import * as XLSX from 'xlsx';

export default function WordManagement() {
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingWord, setEditingWord] = useState(null);
    const [formData, setFormData] = useState({
        english: '',
        korean: '',
        level_group: 1,
        book_name: '',
        unit_name: '',
        word_order: ''
    });
    const [filterBookName, setFilterBookName] = useState('');
    const [filterUnitName, setFilterUnitName] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchWords();
    }, []);

    const fetchWords = async () => {
        try {
            const response = await getAllWords();
            // API returns { data: [...], meta: {...} } or just [...] depending on implementation
            // Safe check to handle both cases
            setWords(Array.isArray(response) ? response : (response.data || []));
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
            setFormData({ english: '', korean: '', level_group: 1, book_name: '', unit_name: '', word_order: '' });
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
            level_group: word.LEVEL_GROUP || word.level_group || 1,
            book_name: word.BOOK_NAME || word.book_name || '',
            unit_name: word.UNIT_NAME || word.unit_name || '',
            word_order: word.WORD_ORDER || word.word_order || ''
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

    // Excel Functions
    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            { book_name: '교재명', unit_name: '단원명', word_order: 1, english: 'apple', korean: '사과', level_group: 1 },
            { book_name: '교재명', unit_name: '단원명', word_order: 2, english: 'banana', korean: '바나나', level_group: 1 }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, '단어등록_템플릿.xlsx');
    };

    const handleExportData = () => {
        const dataToExport = words.map(word => ({
            book_name: word.BOOK_NAME || word.book_name,
            unit_name: word.UNIT_NAME || word.unit_name,
            word_order: word.WORD_ORDER || word.word_order,
            english: word.ENGLISH || word.english,
            korean: word.KOREAN || word.korean,
            level_group: word.LEVEL_GROUP || word.level_group
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Words');
        XLSX.writeFile(wb, `단어목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert('데이터가 없습니다.');
                    return;
                }

                setLoading(true);
                let successCount = 0;
                let failCount = 0;

                for (const row of data) {
                    try {
                        await addWord({
                            book_name: row.book_name || row.교재명 || row.BOOK_NAME || '',
                            unit_name: row.unit_name || row.단원명 || row.UNIT_NAME || '',
                            word_order: row.word_order || row.번호 || row.WORD_ORDER || null,
                            english: row.english || row.English || row.ENGLISH || row.영단어 || '',
                            korean: row.korean || row.Korean || row.KOREAN || row.뜻 || row.한글 || '',
                            level_group: row.level_group || row.Level || row.LEVEL_GROUP || 1
                        });
                        successCount++;
                    } catch (err) {
                        console.error('Row failed:', row, err);
                        failCount++;
                    }
                }

                alert(`업로드 완료: 성공 ${successCount}건, 실패 ${failCount}건`);
                fetchWords();
            } catch (err) {
                console.error('Excel processing error:', err);
                alert('엑셀 파일 처리 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };



    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                    <div className="flex items-center space-x-3">
                        <BookOpen className="w-8 h-8 text-indigo-600" />
                        <h1 className="text-3xl font-bold text-gray-800">단어 관리</h1>
                        <span className="text-gray-500">({words.length}개)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleDownloadTemplate}
                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center space-x-2 text-sm"
                            title="엑셀 템플릿 다운로드"
                        >
                            <FileDown className="w-4 h-4" />
                            <span className="hidden sm:inline">템플릿</span>
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 text-sm"
                            title="엑셀 파일 업로드"
                        >
                            <Upload className="w-4 h-4" />
                            <span className="hidden sm:inline">업로드</span>
                        </button>
                        <button
                            onClick={handleExportData}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 text-sm"
                            title="엑셀로 내보내기"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">내보내기</span>
                        </button>
                        <button
                            onClick={() => {
                                setEditingWord(null);
                                setFormData({ english: '', korean: '', level_group: 1, book_name: '', unit_name: '', word_order: '' });
                                setShowModal(true);
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2 text-sm"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="hidden sm:inline">추가</span>
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleExcelUpload}
                            accept=".xlsx, .xls"
                            className="hidden"
                        />
                    </div>
                </div>

                {/* Filter Controls */}
                <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium text-gray-700 mb-1">교재명 필터</label>
                            <input
                                type="text"
                                value={filterBookName}
                                onChange={(e) => setFilterBookName(e.target.value)}
                                placeholder="교재명으로 필터링"
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium text-gray-700 mb-1">단원명 필터</label>
                            <input
                                type="text"
                                value={filterUnitName}
                                onChange={(e) => setFilterUnitName(e.target.value)}
                                placeholder="단원명으로 필터링"
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <button
                            onClick={() => {
                                setFilterBookName('');
                                setFilterUnitName('');
                                fetchWords();
                            }}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                            필터 초기화
                        </button>
                        {filterBookName && (
                            <button
                                onClick={async () => {
                                    if (!window.confirm(`"${filterBookName}" 교재의 모든 단어를 삭제하시겠습니까?`)) return;
                                    try {
                                        await deleteWordsByBook(filterBookName);
                                        alert('삭제되었습니다.');
                                        fetchWords();
                                    } catch (err) {
                                        console.error('삭제 실패:', err);
                                        alert('삭제에 실패했습니다.');
                                    }
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                선택된 교재 전체 삭제
                            </button>
                        )}
                    </div>
                </div>

                {/* Words Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">교재명</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">단원명</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">번호</th>
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
                                    <td className="px-6 py-4 text-sm text-gray-600">{word.BOOK_NAME || word.book_name || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{word.UNIT_NAME || word.unit_name || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{word.WORD_ORDER || word.word_order || '-'}</td>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">교재명</label>
                                    <input
                                        type="text"
                                        value={formData.book_name}
                                        onChange={(e) => setFormData({ ...formData, book_name: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        placeholder="예: 중등 영단어"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">단원명</label>
                                    <input
                                        type="text"
                                        value={formData.unit_name}
                                        onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        placeholder="예: Unit 1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">번호</label>
                                    <input
                                        type="number"
                                        value={formData.word_order}
                                        onChange={(e) => setFormData({ ...formData, word_order: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        placeholder="단어 순서"
                                    />
                                </div>
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

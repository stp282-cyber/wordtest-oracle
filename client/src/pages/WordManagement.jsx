import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Trash2, Plus, BookOpen } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';

export default function WordManagement() {
    const [words, setWords] = useState([]);
    const [newWord, setNewWord] = useState({ book_name: '기본', word_number: '', english: '', korean: '' });
    const [filterBookName, setFilterBookName] = useState('전체');
    const fetchWords = useCallback(async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'words'));
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by word_number if available
            data.sort((a, b) => (a.word_number || 0) - (b.word_number || 0));
            setWords(data);
        } catch (err) {
            console.error("Error fetching words:", err);
        }
    }, []);

    useEffect(() => {
        fetchWords();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const bookNames = ['전체', ...new Set(words.map(w => w.book_name).filter(Boolean))];

    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            const formattedWords = jsonData.map(row => ({
                book_name: row.단어장명 || row.book_name || '기본',
                word_number: row.번호 || row.word_number ? parseInt(row.번호 || row.word_number) : null,
                english: row.영단어 || row.english || row.영어 || '',
                korean: row.뜻 || row.korean || row.한글 || ''
            })).filter(w => w.english && w.korean);

            console.log('Formatted words:', formattedWords);
            uploadWords(formattedWords);
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const uploadWords = async (wordsToUpload) => {
        try {
            console.log('Uploading words:', wordsToUpload);

            // Firestore batch write (limit 500 operations per batch)
            const batchSize = 500;
            const chunks = [];
            for (let i = 0; i < wordsToUpload.length; i += batchSize) {
                chunks.push(wordsToUpload.slice(i, i + batchSize));
            }

            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(word => {
                    const docRef = doc(collection(db, "words")); // Auto-ID
                    batch.set(docRef, word);
                });
                await batch.commit();
            }

            alert(`${wordsToUpload.length}개의 단어가 추가되었습니다!`);
            fetchWords();
        } catch (err) {
            console.error('Upload error:', err);
            alert('업로드 실패: ' + err.message);
        }
    };

    const handleAddWord = async (e) => {
        e.preventDefault();
        if (!newWord.english || !newWord.korean) return;

        try {
            await addDoc(collection(db, 'words'), {
                ...newWord,
                word_number: newWord.word_number ? parseInt(newWord.word_number) : null
            });
            setNewWord({ book_name: '기본', word_number: '', english: '', korean: '' });
            fetchWords();
        } catch (err) {
            console.error("Error adding word:", err);
            alert("단어 추가 실패");
        }
    };

    const handleDeleteWord = async (id) => {
        if (!confirm('이 단어를 삭제하시겠습니까?')) return;

        try {
            await deleteDoc(doc(db, 'words', id));
            fetchWords();
        } catch (err) {
            alert('삭제 실패: ' + err.message);
        }
    };

    const downloadTemplate = () => {
        const template = [
            { 단어장명: '기본', 번호: 1, 영단어: 'apple', 뜻: '사과' },
            { 단어장명: '기본', 번호: 2, 영단어: 'banana', 뜻: '바나나' },
        ];
        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '단어장');
        XLSX.writeFile(wb, '단어장_템플릿.xlsx');
    };

    const filteredWords = filterBookName === '전체' ? words : words.filter(w => w.book_name === filterBookName);

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <header className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-3 bg-indigo-600 rounded-lg">
                            <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">단어 관리</h1>
                    </div>
                </header>

                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4">엑셀 파일 업로드</h2>
                    <div className="flex items-center space-x-4 mb-4">
                        <label className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl cursor-pointer hover:bg-indigo-700 transition-all">
                            <Upload className="w-5 h-5 mr-2" />
                            <span>엑셀 파일 선택</span>
                            <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="hidden" />
                        </label>
                        <button onClick={downloadTemplate} className="flex items-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all">
                            <span>📥 템플릿 다운로드</span>
                        </button>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800 font-medium mb-2">📋 엑셀 파일 형식 안내</p>
                        <div className="text-sm text-blue-700 space-y-1">
                            <p>• 첫 행(헤더): <code className="bg-blue-100 px-2 py-0.5 rounded">단어장명 | 번호 | 영단어 | 뜻</code></p>
                            <p>• 예시: <code className="bg-blue-100 px-2 py-0.5 rounded">기본 | 1 | apple | 사과</code></p>
                            <p>• 단어장명이 없으면 '기본'으로 자동 설정됩니다.</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4">단어 직접 추가</h2>
                    <form onSubmit={handleAddWord} className="grid grid-cols-4 gap-4">
                        <input type="text" placeholder="단어장명 (예: 기본)" value={newWord.book_name} onChange={(e) => setNewWord({ ...newWord, book_name: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                        <input type="number" placeholder="번호 (선택)" value={newWord.word_number} onChange={(e) => setNewWord({ ...newWord, word_number: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                        <input type="text" placeholder="영단어" value={newWord.english} onChange={(e) => setNewWord({ ...newWord, english: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                        <input type="text" placeholder="뜻" value={newWord.korean} onChange={(e) => setNewWord({ ...newWord, korean: e.target.value })} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                        <button type="submit" className="col-span-4 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-all flex items-center justify-center space-x-2">
                            <Plus className="w-5 h-5" />
                            <span>추가</span>
                        </button>
                    </form>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">등록된 단어 ({filteredWords.length}개)</h2>
                        <select value={filterBookName} onChange={(e) => setFilterBookName(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                            {bookNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-gray-500">
                                    <th className="pb-3 font-medium">단어장명</th>
                                    <th className="pb-3 font-medium w-20">번호</th>
                                    <th className="pb-3 font-medium">영단어</th>
                                    <th className="pb-3 font-medium">뜻</th>
                                    <th className="pb-3 font-medium w-24">작업</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredWords.map((word) => (
                                    <tr key={word.id}>
                                        <td className="py-3 text-gray-600">{word.book_name || '기본'}</td>
                                        <td className="py-3 text-gray-500">{word.word_number || '-'}</td>
                                        <td className="py-3 font-medium text-gray-900">{word.english}</td>
                                        <td className="py-3 text-gray-600">{word.korean}</td>
                                        <td className="py-3">
                                            <button onClick={() => handleDeleteWord(word.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredWords.length === 0 && (
                            <p className="text-center text-gray-400 py-8">등록된 단어가 없습니다.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

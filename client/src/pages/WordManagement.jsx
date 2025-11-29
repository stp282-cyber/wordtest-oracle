import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Trash2, Plus, BookOpen, Edit2, Save, X, AlertTriangle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch, updateDoc, query, where, increment, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export default function WordManagement() {
    const [words, setWords] = useState([]);
    const [newWord, setNewWord] = useState({ book_name: '기본', word_number: '', english: '', korean: '' });
    const [filterBookName, setFilterBookName] = useState('기본');
    const [editingWord, setEditingWord] = useState(null);

    const fetchWords = useCallback(async () => {
        try {
            const academyId = localStorage.getItem('academyId') || 'academy_default';
            // Filter words by academyId
            const q = query(collection(db, 'words'), where('academyId', '==', academyId));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by book_name first, then word_number
            data.sort((a, b) => {
                const bookA = (a.book_name || '').toString();
                const bookB = (b.book_name || '').toString();
                if (bookA < bookB) return -1;
                if (bookA > bookB) return 1;
                return (a.word_number || 0) - (b.word_number || 0);
            });
            setWords(data);
        } catch (err) {
            console.error("Error fetching words:", err);
        }
    }, []);

    useEffect(() => {
        fetchWords();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const bookNames = ['전체', '기본', ...new Set(words.map(w => w.book_name).filter(n => n && n !== '기본'))];

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
            const academyId = localStorage.getItem('academyId') || 'academy_default';

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
                    batch.set(docRef, { ...word, academyId }); // Add academyId
                });
                await batch.commit();
            }

            // Update books collection counts
            const bookCounts = {};
            wordsToUpload.forEach(word => {
                const bookName = word.book_name || '기본';
                bookCounts[bookName] = (bookCounts[bookName] || 0) + 1;
            });

            const batch = writeBatch(db);
            for (const [bookName, count] of Object.entries(bookCounts)) {
                const bookId = `${academyId}_${bookName}`;
                const bookRef = doc(db, 'books', bookId);
                batch.set(bookRef, {
                    academyId,
                    name: bookName,
                    totalWords: increment(count),
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
            await batch.commit();

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
            const academyId = localStorage.getItem('academyId') || 'academy_default';
            await addDoc(collection(db, 'words'), {
                ...newWord,
                word_number: newWord.word_number ? parseInt(newWord.word_number) : null,
                academyId // Add academyId
            });

            // Update books collection
            const bookId = `${academyId}_${newWord.book_name}`;
            const bookRef = doc(db, 'books', bookId);
            await setDoc(bookRef, {
                academyId,
                name: newWord.book_name,
                totalWords: increment(1),
                updatedAt: serverTimestamp()
            }, { merge: true });

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
            const wordRef = doc(db, 'words', id);
            const wordDoc = await getDoc(wordRef);

            if (wordDoc.exists()) {
                const wordData = wordDoc.data();
                const academyId = wordData.academyId || 'academy_default';
                const bookName = wordData.book_name || '기본';

                await deleteDoc(wordRef);

                // Update books collection
                const bookId = `${academyId}_${bookName}`;
                const bookRef = doc(db, 'books', bookId);
                await updateDoc(bookRef, {
                    totalWords: increment(-1)
                });
            }

            fetchWords();
        } catch (err) {
            alert('삭제 실패: ' + err.message);
        }
    };

    const handleUpdateWord = async () => {
        if (!editingWord) return;
        try {
            const wordRef = doc(db, 'words', editingWord.id);
            await updateDoc(wordRef, {
                book_name: editingWord.book_name,
                word_number: editingWord.word_number ? parseInt(editingWord.word_number) : null,
                english: editingWord.english,
                korean: editingWord.korean
            });
            setEditingWord(null);
            fetchWords();
        } catch (err) {
            console.error("Error updating word:", err);
            alert("수정 실패");
        }
    };

    const handleDeleteBook = async () => {
        if (filterBookName === '전체') {
            alert('삭제할 단어장을 선택해주세요.');
            return;
        }

        if (!confirm(`'${filterBookName}' 단어장의 모든 단어를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

        try {
            const q = query(collection(db, 'words'), where('book_name', '==', filterBookName));
            const snapshot = await getDocs(q);

            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            // Delete book metadata
            const academyId = localStorage.getItem('academyId') || 'academy_default';
            const bookId = `${academyId}_${filterBookName}`;
            batch.delete(doc(db, 'books', bookId));

            await batch.commit();
            alert(`'${filterBookName}' 단어장이 삭제되었습니다.`);
            setFilterBookName('전체');
            fetchWords();
        } catch (err) {
            console.error("Error deleting book:", err);
            alert("단어장 삭제 실패");
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

    const generateBooksCollection = async () => {
        if (!confirm('기존 단어 데이터를 기반으로 단어장 목록을 생성하시겠습니까?\n\n이 작업은 words 컬렉션의 모든 단어를 스캔하여 books 컬렉션을 생성/업데이트합니다.')) {
            return;
        }

        try {
            const academyId = localStorage.getItem('academyId') || 'academy_default';

            // Fetch all words for this academy
            const q = query(collection(db, 'words'), where('academyId', '==', academyId));
            const snapshot = await getDocs(q);

            // Count words by book name
            const bookCounts = {};
            snapshot.docs.forEach(doc => {
                const bookName = doc.data().book_name || '기본';
                bookCounts[bookName] = (bookCounts[bookName] || 0) + 1;
            });

            // Create/update books collection
            const batch = writeBatch(db);
            for (const [bookName, count] of Object.entries(bookCounts)) {
                const bookId = `${academyId}_${bookName}`;
                const bookRef = doc(db, 'books', bookId);
                batch.set(bookRef, {
                    academyId,
                    name: bookName,
                    totalWords: count,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
            await batch.commit();

            alert(`✅ 단어장 목록 생성 완료!\n\n총 ${Object.keys(bookCounts).length}개의 단어장이 생성되었습니다:\n${Object.entries(bookCounts).map(([name, count]) => `- ${name}: ${count}단어`).join('\n')}`);

        } catch (error) {
            console.error('Error generating books collection:', error);
            alert('단어장 목록 생성 중 오류가 발생했습니다: ' + error.message);
        }
    };

    const filteredWords = filterBookName === '전체' ? words : words.filter(w => w.book_name === filterBookName);

    const handleDownloadExcel = () => {
        if (filteredWords.length === 0) {
            alert('다운로드할 단어가 없습니다.');
            return;
        }

        const dataToExport = filteredWords.map(word => ({
            단어장명: word.book_name,
            번호: word.word_number,
            영단어: word.english,
            뜻: word.korean
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, filterBookName === '전체' ? '전체단어' : filterBookName);

        const fileName = filterBookName === '전체'
            ? `전체단어목록_${new Date().toISOString().slice(0, 10)}.xlsx`
            : `${filterBookName}_단어목록_${new Date().toISOString().slice(0, 10)}.xlsx`;

        XLSX.writeFile(wb, fileName);
    };

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
                        <button onClick={generateBooksCollection} className="flex items-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all">
                            <BookOpen className="w-5 h-5 mr-2" />
                            <span>단어장 목록 생성</span>
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
                        <div className="flex gap-2">
                            <button
                                onClick={handleDownloadExcel}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-bold"
                            >
                                <Download className="w-4 h-4" />
                                엑셀 다운로드
                            </button>
                            {filterBookName !== '전체' && (
                                <button
                                    onClick={handleDeleteBook}
                                    className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2 text-sm font-bold"
                                >
                                    <AlertTriangle className="w-4 h-4" />
                                    '{filterBookName}' 단어장 전체 삭제
                                </button>
                            )}
                            <select value={filterBookName} onChange={(e) => setFilterBookName(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                                {bookNames.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-gray-500">
                                    <th className="pb-3 font-medium">단어장명</th>
                                    <th className="pb-3 font-medium w-20">번호</th>
                                    <th className="pb-3 font-medium">영단어</th>
                                    <th className="pb-3 font-medium">뜻</th>
                                    <th className="pb-3 font-medium w-32 text-center">작업</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredWords.map((word) => (
                                    <tr key={word.id} className="hover:bg-gray-50">
                                        {editingWord && editingWord.id === word.id ? (
                                            <>
                                                <td className="py-2">
                                                    <input
                                                        type="text"
                                                        value={editingWord.book_name}
                                                        onChange={(e) => setEditingWord({ ...editingWord, book_name: e.target.value })}
                                                        className="w-full px-2 py-1 border rounded"
                                                    />
                                                </td>
                                                <td className="py-2">
                                                    <input
                                                        type="number"
                                                        value={editingWord.word_number || ''}
                                                        onChange={(e) => setEditingWord({ ...editingWord, word_number: e.target.value })}
                                                        className="w-full px-2 py-1 border rounded"
                                                    />
                                                </td>
                                                <td className="py-2">
                                                    <input
                                                        type="text"
                                                        value={editingWord.english}
                                                        onChange={(e) => setEditingWord({ ...editingWord, english: e.target.value })}
                                                        className="w-full px-2 py-1 border rounded"
                                                    />
                                                </td>
                                                <td className="py-2">
                                                    <input
                                                        type="text"
                                                        value={editingWord.korean}
                                                        onChange={(e) => setEditingWord({ ...editingWord, korean: e.target.value })}
                                                        className="w-full px-2 py-1 border rounded"
                                                    />
                                                </td>
                                                <td className="py-2 flex justify-center gap-2">
                                                    <button onClick={handleUpdateWord} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setEditingWord(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="py-3 text-gray-600">{word.book_name || '기본'}</td>
                                                <td className="py-3 text-gray-500">{word.word_number || '-'}</td>
                                                <td className="py-3 font-medium text-gray-900">{word.english}</td>
                                                <td className="py-3 text-gray-600">{word.korean}</td>
                                                <td className="py-3 flex justify-center gap-2">
                                                    <button onClick={() => setEditingWord(word)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeleteWord(word.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </>
                                        )}
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

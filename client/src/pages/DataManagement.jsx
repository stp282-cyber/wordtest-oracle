import React, { useState, useEffect } from 'react';
import { Download, Upload, Database, AlertTriangle, Check, Server, Building } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, getDocs, query, where, writeBatch, doc, getDoc, setDoc } from 'firebase/firestore';

export default function DataManagement() {
    const [role, setRole] = useState(null);
    const [currentAcademyId, setCurrentAcademyId] = useState(null);
    const [academies, setAcademies] = useState([]);
    const [selectedAcademy, setSelectedAcademy] = useState('');
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({
        users: 0,
        words: 0,
        classes: 0,
        results: 0
    });

    useEffect(() => {
        const init = async () => {
            const userRole = localStorage.getItem('role');
            const academyId = localStorage.getItem('academyId');
            setRole(userRole);
            setCurrentAcademyId(academyId);

            if (userRole === 'super_admin') {
                fetchAcademies();
            } else {
                setSelectedAcademy(academyId); // Default to own academy
            }
            fetchStats(academyId);
        };
        init();
    }, []);

    const fetchAcademies = async () => {
        try {
            const q = query(collection(db, 'academies'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAcademies(data);
        } catch (error) {
            console.error("Error fetching academies:", error);
        }
    };

    const fetchStats = async (academyId) => {
        if (!academyId) return;
        // This is a rough estimate, real-time count might be expensive
        // For now just showing 0 or implementing a simple count if needed
        // Skipping heavy count queries for performance
    };

    const handleBackup = async () => {
        if (!selectedAcademy) {
            alert('백업할 학원을 선택해주세요.');
            return;
        }

        if (!window.confirm('데이터 백업을 시작하시겠습니까?')) return;

        setLoading(true);
        try {
            const targetAcademyId = selectedAcademy;
            const collections = ['users', 'classes', 'words', 'test_results'];
            const backupData = {
                metadata: {
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    academyId: targetAcademyId,
                    exportedBy: auth.currentUser.email
                },
                data: {}
            };

            for (const colName of collections) {
                let q;
                if (colName === 'test_results') {
                    // For test_results, we might need to filter by user IDs belonging to the academy
                    // But for simplicity and performance, we'll fetch all and filter in memory OR 
                    // if the schema supports academyId on test_results (it should), use that.
                    // Checking schema... test_results usually has user_id. 
                    // Let's first get users of this academy.
                    const userQ = query(collection(db, 'users'), where('academyId', '==', targetAcademyId));
                    const userSnap = await getDocs(userQ);
                    const userIds = userSnap.docs.map(d => d.id);

                    if (userIds.length > 0) {
                        // Firestore 'in' query is limited to 10. We need to batch or fetch all and filter.
                        // Fetching all test_results might be too heavy.
                        // Ideally test_results should have academyId. If not, we iterate users.
                        // Let's assume we iterate users for now or fetch all if dataset is small.
                        // BETTER: Fetch all test_results and filter by user_id in memory (if not too large)
                        // OR: Add academyId to test_results in the future.
                        // CURRENT STRATEGY: Fetch all and filter.
                        const allResultsSnap = await getDocs(collection(db, 'test_results'));
                        backupData.data[colName] = allResultsSnap.docs
                            .map(d => ({ id: d.id, ...d.data() }))
                            .filter(r => userIds.includes(r.user_id));
                    } else {
                        backupData.data[colName] = [];
                    }
                } else {
                    q = query(collection(db, colName), where('academyId', '==', targetAcademyId));
                    const snapshot = await getDocs(q);
                    backupData.data[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            }

            // Download
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${targetAcademyId}_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert('백업이 완료되었습니다.');
        } catch (err) {
            console.error("Backup failed:", err);
            alert('백업 실패: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!selectedAcademy) {
            alert('복원할 대상 학원을 선택해주세요.');
            e.target.value = '';
            return;
        }

        if (!window.confirm('데이터를 복원하시겠습니까?\n기존 데이터와 병합되거나 덮어씌워질 수 있습니다.')) {
            e.target.value = '';
            return;
        }

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target.result);

                // Validation
                if (!json.metadata || !json.data) {
                    throw new Error('올바르지 않은 백업 파일 형식입니다.');
                }

                const targetAcademyId = selectedAcademy;
                const batchSize = 500;
                let operationCount = 0;

                for (const [colName, items] of Object.entries(json.data)) {
                    const chunks = [];
                    for (let i = 0; i < items.length; i += batchSize) {
                        chunks.push(items.slice(i, i + batchSize));
                    }

                    for (const chunk of chunks) {
                        const batch = writeBatch(db);
                        chunk.forEach(item => {
                            const docRef = doc(db, colName, item.id);
                            const data = { ...item };

                            // Security: Enforce academyId
                            if (colName !== 'test_results') { // test_results might not have academyId directly
                                data.academyId = targetAcademyId;
                            }

                            // Remove id from data if it exists (it's in docRef)
                            delete data.id;

                            batch.set(docRef, data, { merge: true });
                            operationCount++;
                        });
                        await batch.commit();
                    }
                }

                alert(`복원이 완료되었습니다. (총 ${operationCount}개 항목 처리)`);
            } catch (err) {
                console.error("Restore failed:", err);
                alert('복원 실패: ' + err.message);
            } finally {
                setLoading(false);
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex items-center space-x-4 mb-8">
                    <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                        <Database className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">데이터 관리</h1>
                        <p className="text-gray-500">데이터 백업 및 복원</p>
                    </div>
                </header>

                {/* Target Selection (Super Admin Only) */}
                {role === 'super_admin' && (
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                        <h2 className="text-lg font-semibold mb-4 flex items-center">
                            <Building className="w-5 h-5 mr-2 text-gray-500" />
                            대상 학원 선택
                        </h2>
                        <select
                            value={selectedAcademy}
                            onChange={(e) => setSelectedAcademy(e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="">학원을 선택하세요</option>
                            {academies.map(academy => (
                                <option key={academy.id} value={academy.id}>
                                    {academy.name} ({academy.id})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Backup Section */}
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                <Download className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">EXPORT</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">데이터 백업</h2>
                        <p className="text-sm text-gray-500 mb-6">
                            선택한 학원의 모든 데이터(학생, 단어, 성적 등)를 JSON 파일로 다운로드합니다.
                        </p>

                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-600 space-y-2">
                                <p>• 대상: {role === 'super_admin' ? (selectedAcademy ? academies.find(a => a.id === selectedAcademy)?.name : '선택 필요') : '현재 학원'}</p>
                                <p>• 포함: 학생 정보, 단어장, 시험 결과, 반 정보</p>
                            </div>

                            <button
                                onClick={handleBackup}
                                disabled={loading || (role === 'super_admin' && !selectedAcademy)}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl font-bold transition-colors flex items-center justify-center"
                            >
                                {loading ? '처리 중...' : '백업 파일 다운로드'}
                            </button>
                        </div>
                    </div>

                    {/* Restore Section */}
                    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                                <Upload className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">IMPORT</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">데이터 복원</h2>
                        <p className="text-sm text-gray-500 mb-6">
                            백업 파일을 업로드하여 데이터를 복원합니다. 기존 데이터와 병합됩니다.
                        </p>

                        <div className="space-y-4">
                            <div className="p-4 bg-yellow-50 rounded-xl text-sm text-yellow-800 space-y-2">
                                <div className="flex items-start">
                                    <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                                    <p>주의: 복원 시 선택한 학원({role === 'super_admin' ? (selectedAcademy || '선택 필요') : '현재 학원'})의 데이터로 강제 변환되어 저장됩니다.</p>
                                </div>
                            </div>

                            <label className={`w-full py-3 ${loading || (role === 'super_admin' && !selectedAcademy) ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 cursor-pointer'} text-white rounded-xl font-bold transition-colors flex items-center justify-center`}>
                                {loading ? '처리 중...' : '백업 파일 업로드'}
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleRestore}
                                    disabled={loading || (role === 'super_admin' && !selectedAcademy)}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { Shield, Check, AlertTriangle, Loader } from 'lucide-react';

export default function MigrationTool() {
    const [status, setStatus] = useState('idle'); // idle, processing, success, error
    const [logs, setLogs] = useState([]);
    const [progress, setProgress] = useState(0);

    const addLog = (message) => {
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const runMigration = async () => {
        if (!confirm('데이터 마이그레이션을 시작하시겠습니까?\n모든 데이터가 현재 학원(1호점)으로 귀속됩니다.')) return;

        setStatus('processing');
        setLogs([]);
        setProgress(0);

        try {
            // 1. Create Default Academy
            addLog('🚀 마이그레이션 시작...');
            const academyId = 'academy_default'; // Fixed ID for the first academy
            const academyRef = doc(db, 'academies', academyId);

            await setDoc(academyRef, {
                name: '이스턴 영어 학원 (본점)',
                plan: 'pro',
                createdAt: new Date().toISOString(),
                isDefault: true
            }, { merge: true });

            addLog(`✅ 기본 학원 생성 완료: ${academyId}`);
            setProgress(10);

            // 2. Migrate Users
            addLog('👥 사용자 데이터 마이그레이션 중...');
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const userBatch = writeBatch(db);
            let userCount = 0;

            usersSnapshot.docs.forEach(doc => {
                const userData = doc.data();
                if (!userData.academyId) {
                    userBatch.update(doc.ref, { academyId: academyId });
                    userCount++;
                }
            });

            if (userCount > 0) await userBatch.commit();
            addLog(`✅ 사용자 ${userCount}명 업데이트 완료`);
            setProgress(40);

            // 3. Migrate Words
            addLog('📚 단어 데이터 마이그레이션 중...');
            const wordsSnapshot = await getDocs(collection(db, 'words'));
            // Firestore batch limit is 500. We need to handle chunks if there are many words.
            const wordChunks = [];
            let currentChunk = writeBatch(db);
            let operationCount = 0;

            wordsSnapshot.docs.forEach((doc) => {
                const wordData = doc.data();
                if (!wordData.academyId) {
                    currentChunk.update(doc.ref, { academyId: academyId });
                    operationCount++;

                    if (operationCount === 499) {
                        wordChunks.push(currentChunk);
                        currentChunk = writeBatch(db);
                        operationCount = 0;
                    }
                }
            });

            if (operationCount > 0) wordChunks.push(currentChunk);

            for (const chunk of wordChunks) {
                await chunk.commit();
            }
            addLog(`✅ 단어 ${wordsSnapshot.size}개 업데이트 완료`);
            setProgress(70);

            // 4. Migrate Classes
            addLog('🏫 반(Class) 데이터 마이그레이션 중...');
            const classesSnapshot = await getDocs(collection(db, 'classes'));
            const classBatch = writeBatch(db);
            let classCount = 0;

            classesSnapshot.docs.forEach(doc => {
                const classData = doc.data();
                if (!classData.academyId) {
                    classBatch.update(doc.ref, { academyId: academyId });
                    classCount++;
                }
            });

            if (classCount > 0) await classBatch.commit();
            addLog(`✅ 반 ${classCount}개 업데이트 완료`);
            setProgress(100);

            setStatus('success');
            addLog('🎉 모든 마이그레이션이 성공적으로 완료되었습니다!');

        } catch (err) {
            console.error(err);
            setStatus('error');
            addLog(`❌ 오류 발생: ${err.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
                <div className="flex items-center space-x-4 mb-6">
                    <div className="p-3 bg-indigo-600 rounded-full">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">시스템 업그레이드 도구</h1>
                        <p className="text-gray-500">멀티 학원 시스템으로 전환하기 위한 데이터 마이그레이션</p>
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
                    <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2" />
                        주의사항
                    </h3>
                    <ul className="list-disc list-inside text-blue-800 space-y-1 text-sm">
                        <li>이 작업은 <strong>한 번만</strong> 실행해야 합니다.</li>
                        <li>모든 기존 데이터(학생, 단어, 반)가 <strong>'기본 학원'</strong> 소속으로 변경됩니다.</li>
                        <li>작업 도중 창을 닫지 마세요.</li>
                    </ul>
                </div>

                <div className="space-y-4 mb-8 max-h-60 overflow-y-auto bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                    {logs.length === 0 ? (
                        <span className="text-gray-500">대기 중...</span>
                    ) : (
                        logs.map((log, i) => <div key={i}>{log}</div>)
                    )}
                </div>

                {status === 'processing' && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
                        <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                )}

                <div className="flex justify-end">
                    {status === 'success' ? (
                        <button className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold flex items-center cursor-default">
                            <Check className="w-5 h-5 mr-2" />
                            완료됨
                        </button>
                    ) : (
                        <button
                            onClick={runMigration}
                            disabled={status === 'processing'}
                            className={`px-6 py-3 rounded-xl font-bold flex items-center ${status === 'processing'
                                    ? 'bg-gray-400 cursor-not-allowed text-white'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transition-all'
                                }`}
                        >
                            {status === 'processing' ? (
                                <>
                                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                                    처리 중...
                                </>
                            ) : (
                                '마이그레이션 시작'
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

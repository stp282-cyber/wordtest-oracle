import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, where, getDoc } from 'firebase/firestore';
import { Plus, Trash2, Megaphone, Users } from 'lucide-react';

export default function AnnouncementManagement() {
    const [announcements, setAnnouncements] = useState([]);
    const [classes, setClasses] = useState([]);
    const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', targetClassId: 'all' });
    const [loading, setLoading] = useState(true);
    const [academyId, setAcademyId] = useState(null);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!auth.currentUser) return;
            try {
                const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const userAcademyId = userData.academyId || 'academy_default';
                    setAcademyId(userAcademyId);

                    // Update localStorage to be safe
                    localStorage.setItem('academyId', userAcademyId);
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };
        fetchUserData();
    }, []);

    useEffect(() => {
        if (academyId) {
            fetchClasses();
            fetchAnnouncements();
        }
    }, [academyId]);

    const fetchClasses = async () => {
        try {
            // Filter classes by academyId
            const q = query(collection(db, 'classes'), where('academyId', '==', academyId));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasses(data);
        } catch (error) {
            console.error("Error fetching classes:", error);
        }
    };

    const fetchAnnouncements = async () => {
        try {
            console.log("Fetching announcements for academyId:", academyId);
            // Filter announcements by academyId
            // REMOVED orderBy to avoid Firestore index requirements for now. Sorting client-side.
            const q = query(
                collection(db, 'announcements'),
                where('academyId', '==', academyId)
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort client-side
            data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            console.log("Fetched announcements:", data);
            setAnnouncements(data);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching announcements:", error);
            setLoading(false);
        }
    };

    const handleAddAnnouncement = async (e) => {
        e.preventDefault();
        if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return;
        if (!academyId) {
            alert('학원 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        try {
            const targetClassName = newAnnouncement.targetClassId === 'all'
                ? '전체'
                : classes.find(c => c.id === newAnnouncement.targetClassId)?.name || 'Unknown';

            await addDoc(collection(db, 'announcements'), {
                ...newAnnouncement,
                targetClassName,
                createdAt: new Date().toISOString(),
                authorName: '선생님', // Assuming admin is always '선생님' for now
                academyId // Add academyId
            });

            setNewAnnouncement({ title: '', content: '', targetClassId: 'all' });
            fetchAnnouncements();
            alert('공지사항이 등록되었습니다.');
        } catch (error) {
            console.error("Error adding announcement:", error);
            alert('공지사항 등록 실패');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('정말 삭제하시겠습니까?')) return;
        try {
            await deleteDoc(doc(db, 'announcements', id));
            setAnnouncements(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            console.error("Error deleting announcement:", error);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800 mb-8 flex items-center">
                <Megaphone className="w-8 h-8 mr-3 text-indigo-600" />
                공지사항 관리
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 sticky top-8">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                            <Plus className="w-5 h-5 mr-2" />
                            새 공지 작성
                        </h2>
                        <form onSubmit={handleAddAnnouncement} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">제목</label>
                                <input
                                    type="text"
                                    value={newAnnouncement.title}
                                    onChange={e => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="공지 제목을 입력하세요"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">대상 학급</label>
                                <select
                                    value={newAnnouncement.targetClassId}
                                    onChange={e => setNewAnnouncement({ ...newAnnouncement, targetClassId: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="all">전체 학생</option>
                                    {classes.map(cls => (
                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">내용</label>
                                <textarea
                                    value={newAnnouncement.content}
                                    onChange={e => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-40 resize-none"
                                    placeholder="공지 내용을 입력하세요"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md"
                            >
                                등록하기
                            </button>
                        </form>
                    </div>
                </div>

                {/* List */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">등록된 공지사항</h2>
                    {loading ? (
                        <div className="text-center py-12 text-gray-500">로딩 중...</div>
                    ) : announcements.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300 text-gray-500">
                            등록된 공지사항이 없습니다.
                        </div>
                    ) : (
                        announcements.map(announcement => (
                            <div key={announcement.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold mb-2 ${announcement.targetClassId === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'}`}>
                                            {announcement.targetClassName}
                                        </span>
                                        <h3 className="text-lg font-bold text-gray-800">{announcement.title}</h3>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(announcement.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="text-gray-600 whitespace-pre-wrap text-sm">{announcement.content}</p>
                                <div className="mt-4 text-xs text-gray-400 flex justify-between items-center">
                                    <span>작성자: {announcement.authorName}</span>
                                    <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

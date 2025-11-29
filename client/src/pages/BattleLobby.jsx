import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Users, Plus, LogIn, RefreshCw, Lock } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDoc, deleteDoc, getDocs } from 'firebase/firestore';

export default function BattleLobby() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [newRoomPassword, setNewRoomPassword] = useState('');
    const [newRoomDifficulty, setNewRoomDifficulty] = useState('normal');
    const [availableBooks, setAvailableBooks] = useState([]);
    const [selectedBook, setSelectedBook] = useState('');
    const navigate = useNavigate();
    const userId = localStorage.getItem('userId');
    const userName = localStorage.getItem('name') || localStorage.getItem('username') || 'Unknown';

    // Fetch available books
    useEffect(() => {
        const fetchBooks = async () => {
            try {
                const q = query(collection(db, 'books'));
                const snapshot = await getDocs(q);
                const books = snapshot.docs.map(doc => doc.data().name);
                setAvailableBooks(books);
            } catch (error) {
                console.error("Error fetching books:", error);
            }
        };
        fetchBooks();
    }, []);

    // Listen for active rooms
    useEffect(() => {
        const q = query(
            collection(db, 'battles'),
            where('status', 'in', ['waiting', 'playing'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const roomList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRooms(roomList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Cleanup zombie rooms (rooms where I am host but I am in lobby)
    useEffect(() => {
        const cleanupZombieRooms = async () => {
            if (!userId) return;
            try {
                const q = query(collection(db, 'battles'), where('hostId', '==', userId));
                const snapshot = await getDocs(q);
                const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
            } catch (error) {
                console.error("Error cleaning up zombie rooms:", error);
            }
        };
        cleanupZombieRooms();
    }, [userId]);

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        if (!newRoomName.trim()) return;

        try {
            const roomData = {
                name: newRoomName,
                password: newRoomPassword,
                difficulty: newRoomDifficulty,
                selectedBook: selectedBook,
                hostId: userId,
                hostName: userName,
                status: 'waiting',
                createdAt: new Date().toISOString(),
                players: {
                    [userId]: {
                        id: userId,
                        name: userName,
                        score: 0,
                        passCount: 0,
                        ready: true
                    }
                },
                playerCount: 1,
                maxPlayers: 2
            };

            const docRef = await addDoc(collection(db, 'battles'), roomData);
            setShowCreateModal(false);
            navigate(`/student/battle/${docRef.id}`);
        } catch (error) {
            console.error("Error creating room:", error);
            alert("방 생성 중 오류가 발생했습니다.");
        }
    };

    const handleJoinRoom = async (roomId, hasPassword) => {
        if (hasPassword) {
            const password = prompt("비밀번호를 입력하세요:");
            if (password === null) return;
            // In a real app, verify password here or in a cloud function.
            // For now, we'll fetch the doc to check (client-side check is not secure but okay for prototype)
            const roomRef = doc(db, 'battles', roomId);
            const roomSnap = await getDoc(roomRef);
            if (roomSnap.exists() && roomSnap.data().password !== password) {
                alert("비밀번호가 틀렸습니다.");
                return;
            }
        }

        try {
            const roomRef = doc(db, 'battles', roomId);
            // Transaction is better here to prevent race conditions, but update is simpler for now
            await updateDoc(roomRef, {
                [`players.${userId}`]: {
                    id: userId,
                    name: userName,
                    score: 0,
                    passCount: 0,
                    ready: false
                },
                playerCount: 2
            });
            navigate(`/student/battle/${roomId}`);
        } catch (error) {
            console.error("Error joining room:", error);
            alert("방 입장 중 오류가 발생했습니다. 이미 가득 찼거나 삭제된 방일 수 있습니다.");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-3">
                        <div className="bg-indigo-600 p-3 rounded-xl shadow-lg">
                            <Swords className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">배틀 아레나</h1>
                            <p className="text-gray-500">다른 학생들과 실시간으로 단어 실력을 겨루세요!</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center transform hover:scale-105"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        방 만들기
                    </button>
                </header>

                {/* Room List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {loading ? (
                        <div className="col-span-2 text-center py-12 text-gray-500">
                            로딩 중...
                        </div>
                    ) : rooms.length === 0 ? (
                        <div className="col-span-2 text-center py-12 bg-white rounded-2xl border border-gray-200 border-dashed">
                            <Swords className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 text-lg">현재 대기 중인 방이 없습니다.</p>
                            <p className="text-gray-400 text-sm">새로운 방을 만들어보세요!</p>
                        </div>
                    ) : (
                        rooms.map(room => (
                            <div key={room.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800 flex items-center">
                                            {room.name}
                                            {room.password && <Lock className="w-4 h-4 ml-2 text-gray-400" />}
                                        </h3>
                                        <p className="text-sm text-gray-500">호스트: {room.hostName}</p>
                                    </div>
                                    <div className="flex flex-col items-end space-y-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${room.status === 'playing' ? 'bg-red-100 text-red-600' :
                                            room.playerCount >= room.maxPlayers ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-600'
                                            }`}>
                                            {room.status === 'playing' ? '게임 중' : `${room.playerCount}/${room.maxPlayers}`}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${room.difficulty === 'hard' ? 'bg-red-50 text-red-600 border-red-200' :
                                            room.difficulty === 'easy' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                'bg-yellow-50 text-yellow-600 border-yellow-200'
                                            }`}>
                                            {room.difficulty === 'hard' ? '어려움' : room.difficulty === 'easy' ? '쉬움' : '보통'}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleJoinRoom(room.id, !!room.password)}
                                    disabled={room.playerCount >= room.maxPlayers || room.status === 'playing'}
                                    className={`w-full py-3 rounded-xl font-bold flex items-center justify-center transition-colors ${room.playerCount >= room.maxPlayers || room.status === 'playing'
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                        }`}
                                >
                                    {room.status === 'playing' ? '게임 진행 중' :
                                        room.playerCount >= room.maxPlayers ? '만원' :
                                            <>
                                                <LogIn className="w-5 h-5 mr-2" />
                                                입장하기
                                            </>}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Create Room Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">방 만들기</h2>
                        <form onSubmit={handleCreateRoom} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">방 제목</label>
                                <input
                                    type="text"
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="예: 초등 영단어 한판 붙자!"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">난이도</label>
                                <select
                                    value={newRoomDifficulty}
                                    onChange={(e) => setNewRoomDifficulty(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                >
                                    <option value="easy">쉬움 (초성 힌트)</option>
                                    <option value="normal">보통</option>
                                    <option value="hard">어려움 (시간 제한)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">단어장 선택</label>
                                <select
                                    value={selectedBook}
                                    onChange={(e) => setSelectedBook(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                >
                                    <option value="">전체 단어 (랜덤)</option>
                                    {availableBooks.map(book => (
                                        <option key={book} value={book}>{book}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">비밀번호 (선택)</label>
                                <input
                                    type="password"
                                    value={newRoomPassword}
                                    onChange={(e) => setNewRoomPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="비워두면 공개방"
                                />
                            </div>
                            <div className="flex space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                                >
                                    만들기
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

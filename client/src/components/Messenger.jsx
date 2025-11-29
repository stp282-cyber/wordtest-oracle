import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, User, ChevronLeft, Users } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, setDoc, serverTimestamp, increment, getDocs, getDoc, limit } from 'firebase/firestore';
import { cacheManager, CACHE_DURATION, createCacheKey } from '../utils/cache';

export default function Messenger() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeChat, setActiveChat] = useState(null); // Chat ID
    const [chats, setChats] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    // const [loading, setLoading] = useState(true);
    const [totalUnread, setTotalUnread] = useState(0);

    // For Students
    const [teachers, setTeachers] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'chat'

    // Temporary state to hold chat details when opening via event (before it appears in list)
    const [tempChatData, setTempChatData] = useState(null);

    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('role');
    const userName = localStorage.getItem('name') || 'User';

    // Helper to check if user is admin or super_admin
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    // Use state for academyId to ensure it updates after fetch
    const [academyId, setAcademyId] = useState(localStorage.getItem('academyId'));

    const messagesEndRef = useRef(null);

    // Listen for custom event to open chat
    useEffect(() => {
        const handleOpenChatEvent = (event) => {
            const { chatId, recipientId, recipientName } = event.detail;
            if (chatId) {
                setIsOpen(true);
                setActiveChat(chatId);
                setViewMode('chat');

                // Store temp data for immediate display
                if (recipientId && recipientName) {
                    setTempChatData({
                        id: chatId,
                        recipientId,
                        recipientName
                    });
                }
            }
        };

        window.addEventListener('open-chat', handleOpenChatEvent);
        return () => window.removeEventListener('open-chat', handleOpenChatEvent);
    }, []);

    // Fetch AcademyId if missing
    useEffect(() => {
        const fetchAcademyId = async () => {
            if (!userId) return;

            // Try cache first
            const cacheKey = createCacheKey('user', userId);
            const cached = cacheManager.get(cacheKey);

            if (cached && cached.academyId) {
                setAcademyId(cached.academyId);
                localStorage.setItem('academyId', cached.academyId);
                return;
            }

            // Fetch from database
            try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const fetchedId = data.academyId || 'academy_default';

                    // Cache user data
                    cacheManager.set(cacheKey, data, CACHE_DURATION.USER);

                    setAcademyId(fetchedId);
                    localStorage.setItem('academyId', fetchedId);
                }
            } catch (error) {
                console.error("Error fetching user academyId:", error);
            }
        };
        fetchAcademyId();
    }, [userId]);

    // Fetch Teachers (for Students)
    useEffect(() => {
        if (!isAdmin && isOpen) {
            const fetchTeachers = async () => {
                try {
                    console.log("Fetching teachers for academyId:", academyId);
                    const currentAcademyId = academyId || 'academy_default';

                    // Try cache first
                    const cacheKey = createCacheKey('teachers', currentAcademyId);
                    const cached = cacheManager.get(cacheKey);

                    if (cached) {
                        console.log(`[Cache] Using cached teachers: ${cached.length}`);
                        setTeachers(cached);
                        return;
                    }

                    // Fetch from database
                    const q = query(
                        collection(db, 'users'),
                        where('role', '==', 'admin'),
                        where('academyId', '==', currentAcademyId)
                    );
                    const snapshot = await getDocs(q);
                    const teachersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    console.log(`Found ${teachersList.length} teachers for academy ${currentAcademyId}`);

                    // Cache the data
                    cacheManager.set(cacheKey, teachersList, CACHE_DURATION.TEACHERS);

                    setTeachers(teachersList);
                } catch (error) {
                    console.error("Error fetching teachers:", error);
                }
            };
            fetchTeachers();
        }
    }, [userRole, academyId, isOpen, isAdmin]);

    // Create Chat for Student with specific teacher
    const createStudentChat = async (teacher) => {
        try {
            const chatRef = doc(collection(db, 'chats'));
            const newChatData = {
                studentId: userId,
                studentName: userName,
                teacherId: teacher.id,
                teacherName: teacher.name,
                academyId: academyId,
                lastMessage: '대화를 시작해보세요!',
                updatedAt: serverTimestamp(),
                unreadCount: { [teacher.id]: 1, [userId]: 0 } // Teacher has unread
            };
            await setDoc(chatRef, newChatData);
            return { id: chatRef.id, ...newChatData };
        } catch (error) {
            console.error("Error creating chat:", error);
            return null;
        }
    };

    // Fetch Chats List
    useEffect(() => {
        if (!userId) return;

        let q;
        if (isAdmin) {
            // Admin sees chats where they are the teacher
            q = query(
                collection(db, 'chats'),
                where('teacherId', '==', userId)
                // orderBy('updatedAt', 'desc') // Removed to avoid index requirement
            );
        } else {
            // Student sees only their chats
            q = query(
                collection(db, 'chats'),
                where('studentId', '==', userId)
                // orderBy('updatedAt', 'desc') // Removed to avoid index requirement
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`[Messenger] Fetched ${snapshot.docs.length} chats for user ${userId} (${userRole})`);
            const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort client-side
            chatList.sort((a, b) => {
                const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
                const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
                return dateB - dateA;
            });

            setChats(chatList);
            // setLoading(false);

            // Calculate total unread
            let unread = 0;
            chatList.forEach(chat => {
                unread += (chat.unreadCount?.[userId] || 0);
            });
            setTotalUnread(unread);
        }, (error) => {
            console.error("[Messenger] Error fetching chats:", error);
        });

        return () => unsubscribe();
    }, [userId, userRole, isAdmin]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const markAsRead = useCallback(async (chatId) => {
        if (!chatId) return;
        const chatRef = doc(db, 'chats', chatId);

        try {
            await updateDoc(chatRef, {
                [`unreadCount.${userId}`]: 0
            });
        } catch (err) {
            console.error("Error marking as read:", err);
        }
    }, [userId]);

    // Fetch Messages for Active Chat
    useEffect(() => {
        if (!activeChat) return;

        const q = query(
            collection(db, 'chats', activeChat, 'messages'),
            orderBy('timestamp', 'asc'),
            limit(50) // Limit to last 50 messages
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);
            scrollToBottom();
            markAsRead(activeChat);
        });

        return () => unsubscribe();
    }, [activeChat, markAsRead]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChat) return;

        const text = newMessage;
        setNewMessage('');

        // Add message
        await addDoc(collection(db, 'chats', activeChat, 'messages'), {
            text,
            senderId: userId,
            senderName: userName,
            timestamp: serverTimestamp()
        });

        // Update chat metadata
        const chatRef = doc(db, 'chats', activeChat);
        const currentChat = chats.find(c => c.id === activeChat);

        // Determine recipient ID
        let recipientId;
        if (currentChat) {
            recipientId = !isAdmin ? currentChat.teacherId : currentChat.studentId;
        } else if (tempChatData && tempChatData.id === activeChat) {
            recipientId = tempChatData.recipientId;
        } else {
            console.error("Cannot find recipient ID");
            return;
        }

        await updateDoc(chatRef, {
            lastMessage: text,
            updatedAt: serverTimestamp(),
            [`unreadCount.${recipientId}`]: increment(1)
        });
    };

    const openChat = (chatId) => {
        setActiveChat(chatId);
        setViewMode('chat');
        setTempChatData(null); // Clear temp data when opening from list
    };

    const handleSelectTeacher = async (teacher) => {
        // Check if chat already exists
        const existingChat = chats.find(c => c.teacherId === teacher.id);
        if (existingChat) {
            openChat(existingChat.id);
        } else {
            const newChat = await createStudentChat(teacher);
            if (newChat) {
                openChat(newChat.id);
            }
        }
    };

    const handleCloseChat = () => {
        setActiveChat(null);
        setViewMode('list');
        setTempChatData(null);
    };

    // Helper to get chat title
    const getChatTitle = () => {
        if (!activeChat) return '메신저';

        const chat = chats.find(c => c.id === activeChat);
        if (chat) {
            return isAdmin ? chat.studentName : (chat.teacherName || '선생님');
        }

        if (tempChatData && tempChatData.id === activeChat) {
            return tempChatData.recipientName;
        }

        return '로딩중...';
    };

    if (!userId) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-scale-in origin-bottom-right">
                    {/* Header */}
                    <div className="bg-indigo-600 p-4 flex justify-between items-center text-white shadow-md">
                        <div className="flex items-center">
                            {viewMode === 'chat' && (
                                <button onClick={handleCloseChat} className="mr-2 hover:bg-indigo-500 p-1 rounded-full">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                            )}
                            <h3 className="font-bold">
                                {viewMode === 'chat' ? getChatTitle() : '메신저'}
                            </h3>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-500 p-1 rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
                        {viewMode === 'list' ? (
                            <div className="space-y-4">
                                {!isAdmin && (
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">대화 목록</h4>
                                        <div className="space-y-2">
                                            {/* 1. Active Chats (from 'chats' state) */}
                                            {chats.map(chat => (
                                                <div
                                                    key={chat.id}
                                                    onClick={() => openChat(chat.id)}
                                                    className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:bg-indigo-50 cursor-pointer transition-colors flex justify-between items-center"
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                                            <User className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-gray-800">{chat.teacherName}</div>
                                                            <div className="text-xs text-gray-500 truncate w-32">
                                                                {chat.lastMessage}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {(chat.unreadCount?.[userId] > 0) && (
                                                        <div className="w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                                                            {chat.unreadCount[userId]}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}

                                            {/* 2. Available Teachers (who don't have a chat yet) */}
                                            {teachers
                                                .filter(teacher => !chats.some(c => c.teacherId === teacher.id))
                                                .map(teacher => (
                                                    <div
                                                        key={teacher.id}
                                                        onClick={() => handleSelectTeacher(teacher)}
                                                        className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:bg-indigo-50 cursor-pointer transition-colors flex justify-between items-center opacity-80 hover:opacity-100"
                                                    >
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                                                                <User className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-gray-700">{teacher.name}</div>
                                                                <div className="text-xs text-gray-400">
                                                                    대화 시작하기
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                            {chats.length === 0 && teachers.length === 0 && (
                                                <div className="text-center text-gray-400 text-sm py-4">
                                                    대화 가능한 선생님이 없습니다.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {isAdmin && (
                                    <div className="space-y-2">
                                        {chats.map(chat => (
                                            <div
                                                key={chat.id}
                                                onClick={() => openChat(chat.id)}
                                                className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:bg-indigo-50 cursor-pointer transition-colors flex justify-between items-center"
                                            >
                                                <div>
                                                    <div className="font-bold text-gray-800">{chat.studentName}</div>
                                                    <div className="text-sm text-gray-500 truncate w-48">{chat.lastMessage}</div>
                                                </div>
                                                {(chat.unreadCount?.[userId] > 0) && (
                                                    <div className="w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                                                        {chat.unreadCount[userId]}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {chats.length === 0 && <div className="text-center text-gray-400 mt-10">대화가 없습니다.</div>}
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Messages Area
                            <div className="space-y-4">
                                {messages.map(msg => {
                                    const isMe = msg.senderId === userId;
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${isMe
                                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                                : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'
                                                }`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input Area (Only if chat is active) */}
                    {viewMode === 'chat' && activeChat && (
                        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-100 flex space-x-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                placeholder="메시지를 입력하세요..."
                            />
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:bg-gray-300 transition-colors"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all transform hover:scale-110 flex items-center justify-center"
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-7 h-7" />}
                {totalUnread > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full border-2 border-white flex items-center justify-center transform translate-x-1 -translate-y-1">
                        {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                )}
            </button>
        </div>
    );
}

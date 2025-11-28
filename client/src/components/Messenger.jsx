import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, User, ChevronLeft } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, setDoc, serverTimestamp, increment } from 'firebase/firestore';

export default function Messenger() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeChat, setActiveChat] = useState(null); // Chat ID
    const [chats, setChats] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [totalUnread, setTotalUnread] = useState(0);

    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('role');
    const userName = localStorage.getItem('name') || 'User';
    const messagesEndRef = useRef(null);

    // 2. Create Chat for Student if not exists
    const createStudentChat = useCallback(async () => {
        const chatRef = doc(collection(db, 'chats'));
        await setDoc(chatRef, {
            studentId: userId,
            studentName: userName,
            teacherId: 'admin', // Placeholder for any admin
            lastMessage: '대화를 시작해보세요!',
            updatedAt: serverTimestamp(),
            unreadCount: { admin: 1, [userId]: 0 } // Admin has unread
        });
    }, [userId, userName]);

    // 1. Fetch Chats List
    useEffect(() => {
        if (!userId) return;

        let q;
        if (userRole === 'admin') {
            // Admin sees all chats
            q = query(collection(db, 'chats'), orderBy('updatedAt', 'desc'));
        } else {
            // Student sees only their chat with teacher
            q = query(collection(db, 'chats'), where('studentId', '==', userId));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setChats(chatList);
            setLoading(false);

            // Calculate total unread
            let unread = 0;
            chatList.forEach(chat => {
                if (userRole === 'admin') {
                    unread += (chat.unreadCount?.admin || 0);
                } else {
                    unread += (chat.unreadCount?.[userId] || 0);
                }
            });
            setTotalUnread(unread);

            // If student has no chat, create one automatically
            if (userRole === 'student' && chatList.length === 0 && !loading) {
                createStudentChat();
            }
        });

        return () => unsubscribe();
    }, [userId, userRole, loading, createStudentChat]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const markAsRead = useCallback(async (chatId) => {
        if (!chatId) return;
        const chatRef = doc(db, 'chats', chatId);

        // Reset unread count for current user
        // If admin, reset 'admin' key. If student, reset their userId key.
        const field = userRole === 'admin' ? 'unreadCount.admin' : `unreadCount.${userId}`;

        try {
            await updateDoc(chatRef, {
                [field]: 0
            });
        } catch (err) {
            console.error("Error marking as read:", err);
        }
    }, [userRole, userId]);

    // 3. Fetch Messages for Active Chat
    useEffect(() => {
        if (!activeChat) return;

        const q = query(
            collection(db, 'chats', activeChat, 'messages'),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);
            scrollToBottom();

            // Mark as read logic could go here (update unreadCount)
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

        // Increment unread for the OTHER party
        // If I am admin, increment student's unread.
        // If I am student, increment 'admin' unread.
        const targetField = userRole === 'admin'
            ? `unreadCount.${currentChat.studentId}`
            : `unreadCount.admin`;

        await updateDoc(chatRef, {
            lastMessage: text,
            updatedAt: serverTimestamp(),
            [targetField]: increment(1)
        });
    };

    const openChat = (chat) => {
        setActiveChat(chat.id);
        // If student, they only have one chat, so it opens automatically or via click
    };

    // Auto-open for student if they have a chat
    useEffect(() => {
        if (userRole === 'student' && chats.length > 0 && !activeChat && isOpen) {
            setTimeout(() => setActiveChat(chats[0].id), 0);
        }
    }, [userRole, chats, isOpen, activeChat]);

    if (!userId) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-scale-in origin-bottom-right">
                    {/* Header */}
                    <div className="bg-indigo-600 p-4 flex justify-between items-center text-white shadow-md">
                        <div className="flex items-center">
                            {activeChat && userRole === 'admin' && (
                                <button onClick={() => setActiveChat(null)} className="mr-2 hover:bg-indigo-500 p-1 rounded-full">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                            )}
                            <h3 className="font-bold">
                                {activeChat
                                    ? (userRole === 'admin' ? chats.find(c => c.id === activeChat)?.studentName : '선생님')
                                    : '메신저'}
                            </h3>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-500 p-1 rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
                        {!activeChat ? (
                            // Chat List (Admin Only)
                            <div className="space-y-2">
                                {chats.map(chat => (
                                    <div
                                        key={chat.id}
                                        onClick={() => openChat(chat)}
                                        className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:bg-indigo-50 cursor-pointer transition-colors flex justify-between items-center"
                                    >
                                        <div>
                                            <div className="font-bold text-gray-800">{chat.studentName}</div>
                                            <div className="text-sm text-gray-500 truncate w-48">{chat.lastMessage}</div>
                                        </div>
                                        {/* Unread Badge */}
                                        {(chat.unreadCount?.admin > 0) && (
                                            <div className="w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                                                {chat.unreadCount.admin}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {chats.length === 0 && <div className="text-center text-gray-400 mt-10">대화가 없습니다.</div>}
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
                    {activeChat && (
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
                {/* Unread Badge Global */}
                {totalUnread > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full border-2 border-white flex items-center justify-center transform translate-x-1 -translate-y-1">
                        {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                )}
            </button>
        </div>
    );
}

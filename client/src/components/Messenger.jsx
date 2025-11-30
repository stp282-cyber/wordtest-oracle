import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, User, ChevronLeft } from 'lucide-react';
import { getChats, createChat, getMessages, sendMessage, markChatRead, getStudents } from '../api/client';
import { cacheManager, CACHE_DURATION, createCacheKey } from '../utils/cache';

export default function Messenger() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeChat, setActiveChat] = useState(null); // Chat ID
    const [chats, setChats] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [totalUnread, setTotalUnread] = useState(0);

    // For Students
    const [teachers, setTeachers] = useState([]);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'chat'

    // Temporary state to hold chat details when opening via event
    const [tempChatData, setTempChatData] = useState(null);

    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('role');
    const userName = localStorage.getItem('name') || 'User';
    const academyId = localStorage.getItem('academyId');

    // Helper to check if user is admin or super_admin
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    const messagesEndRef = useRef(null);
    const pollingRef = useRef(null);

    // Listen for custom event to open chat
    useEffect(() => {
        const handleOpenChatEvent = (event) => {
            const { chatId, recipientId, recipientName } = event.detail;
            if (chatId) {
                setIsOpen(true);
                setActiveChat(chatId);
                setViewMode('chat');

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

    // Fetch Teachers (for Students) - In this simplified version, we might fetch admins
    // Since we don't have a direct 'getTeachers' API, we can assume admins are teachers.
    // However, for now, let's skip fetching teachers list dynamically if not critical, 
    // or implement a getTeachers API later. 
    // Ideally, students should see a list of admins in their academy.
    // For now, let's focus on existing chats.

    // Fetch Chats List (Polling)
    const fetchChats = useCallback(async () => {
        if (!userId) return;
        try {
            const chatList = await getChats(userId, userRole);
            setChats(chatList);

            // Calculate total unread
            let unread = 0;
            chatList.forEach(chat => {
                if (isAdmin) {
                    unread += (chat.UNREAD_TEACHER || 0);
                } else {
                    unread += (chat.UNREAD_STUDENT || 0);
                }
            });
            setTotalUnread(unread);
        } catch (error) {
            console.error("Error fetching chats:", error);
        }
    }, [userId, userRole, isAdmin]);

    useEffect(() => {
        if (isOpen) {
            fetchChats();
            const interval = setInterval(fetchChats, 5000); // Poll every 5 seconds
            return () => clearInterval(interval);
        }
    }, [isOpen, fetchChats]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleMarkAsRead = useCallback(async (chatId) => {
        if (!chatId) return;
        try {
            await markChatRead(chatId, userId, userRole);
            // Optimistically update local state
            setChats(prev => prev.map(c => {
                if (c.ID === chatId) {
                    return {
                        ...c,
                        [isAdmin ? 'UNREAD_TEACHER' : 'UNREAD_STUDENT']: 0
                    };
                }
                return c;
            }));
            fetchChats(); // Refresh to be sure
        } catch (err) {
            console.error("Error marking as read:", err);
        }
    }, [userId, userRole, isAdmin, fetchChats]);

    // Fetch Messages for Active Chat (Polling)
    const fetchActiveMessages = useCallback(async () => {
        if (!activeChat) return;
        try {
            const msgs = await getMessages(activeChat);
            setMessages(msgs);
            // Only scroll if new messages arrived? For now, simple scroll.
            // scrollToBottom(); 
        } catch (error) {
            console.error("Error fetching messages:", error);
        }
    }, [activeChat]);

    useEffect(() => {
        if (activeChat) {
            fetchActiveMessages();
            handleMarkAsRead(activeChat);
            const interval = setInterval(fetchActiveMessages, 3000); // Poll messages every 3s
            return () => clearInterval(interval);
        }
    }, [activeChat, fetchActiveMessages, handleMarkAsRead]);

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChat) return;

        const text = newMessage;
        setNewMessage('');

        try {
            await sendMessage(activeChat, userId, text, userRole);
            fetchActiveMessages(); // Refresh immediately
            fetchChats(); // Refresh chat list for last message update
        } catch (error) {
            console.error("Error sending message:", error);
            alert("메시지 전송 실패");
        }
    };

    const openChat = (chatId) => {
        setActiveChat(chatId);
        setViewMode('chat');
        setTempChatData(null);
    };

    const handleCloseChat = () => {
        setActiveChat(null);
        setViewMode('list');
        setTempChatData(null);
    };

    // Helper to get chat title
    const getChatTitle = () => {
        if (!activeChat) return '메신저';

        const chat = chats.find(c => c.ID === activeChat);
        if (chat) {
            return isAdmin ? chat.STUDENT_NAME : (chat.TEACHER_NAME || '선생님');
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
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">대화 목록</h4>
                                    <div className="space-y-2">
                                        {chats.length === 0 ? (
                                            <div className="text-center text-gray-400 text-sm py-4">
                                                대화 내역이 없습니다.
                                            </div>
                                        ) : (
                                            chats.map(chat => {
                                                const unreadCount = isAdmin ? chat.UNREAD_TEACHER : chat.UNREAD_STUDENT;
                                                const displayName = isAdmin ? chat.STUDENT_NAME : chat.TEACHER_NAME;
                                                return (
                                                    <div
                                                        key={chat.ID}
                                                        onClick={() => openChat(chat.ID)}
                                                        className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:bg-indigo-50 cursor-pointer transition-colors flex justify-between items-center"
                                                    >
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                                                <User className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-gray-800">{displayName}</div>
                                                                <div className="text-xs text-gray-500 truncate w-32">
                                                                    {chat.LAST_MESSAGE}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {(unreadCount > 0) && (
                                                            <div className="w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                                                                {unreadCount}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Messages Area
                            <div className="space-y-4">
                                {messages.map(msg => {
                                    const isMe = msg.SENDER_ID === userId;
                                    return (
                                        <div key={msg.ID} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${isMe
                                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                                : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'
                                                }`}>
                                                {msg.CONTENT}
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

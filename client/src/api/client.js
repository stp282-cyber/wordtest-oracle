import axios from 'axios';
import io from 'socket.io-client';

// API 기본 설정
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Socket.io 연결
export const socket = io(SOCKET_URL, {
    transports: ['websocket'],
    autoConnect: true
});

// ===== 인증 API =====

export const login = async (email, password) => {
    const response = await api.post('/login', { email, password });
    return response.data;
};

// ===== 학생 API =====

export const getStudyHistory = async (userId) => {
    const response = await api.get(`/history/${userId}`);
    return response.data;
};

export const saveTestResult = async (testData) => {
    const response = await api.post('/test-results', testData);
    return response.data;
};

export const getStudentDashboard = async (userId) => {
    const response = await api.get(`/dashboard/student/${userId}`);
    return response.data;
};

// ===== 단어 API =====

export const getWords = async (page = 1, limit = 50) => {
    const response = await api.get(`/words?page=${page}&limit=${limit}`);
    return response.data;
};

// ===== 관리자 API =====

// 학생 관리
export const getStudents = async () => {
    const response = await api.get('/admin/students');
    return response.data;
};

export const addStudent = async (studentData) => {
    const response = await api.post('/admin/students', studentData);
    return response.data;
};

export const updateStudent = async (id, studentData) => {
    const response = await api.put(`/admin/students/${id}`, studentData);
    return response.data;
};

export const deleteStudent = async (id) => {
    const response = await api.delete(`/admin/students/${id}`);
    return response.data;
};

export const deleteWord = async (id) => {
    const response = await api.delete(`/admin/words/${id}`);
    return response.data;
};

// ===== 설정 API =====

export const getSettings = async (key) => {
    const response = await api.get(`/settings/${key}`);
    return response.data;
};

export const saveSettings = async (key, settings) => {
    const response = await api.post(`/settings/${key}`, settings);
    return response.data;
};

// ===== 공지사항 API =====

export const getAnnouncements = async () => {
    const response = await api.get('/announcements');
    return response.data;
};

export const addAnnouncement = async (announcementData) => {
    const response = await api.post('/announcements', announcementData);
    return response.data;
};

export const deleteAnnouncement = async (id) => {
    const response = await api.delete(`/announcements/${id}`);
    return response.data;
};

// ===== 반(Class) API =====

export const getClasses = async () => {
    const response = await api.get('/classes');
    return response.data;
};

export const addClass = async (name) => {
    const response = await api.post('/classes', { name });
    return response.data;
};

export const deleteClass = async (id) => {
    const response = await api.delete(`/classes/${id}`);
    return response.data;
};

// ===== 커리큘럼 및 학생 상세 API =====

export const getStudentDetail = async (id) => {
    const response = await api.get(`/admin/students/${id}`);
    return response.data;
};

// ... (previous code)

export const updateStudentCurriculum = async (id, data) => {
    // data: { class_id, curriculum_data }
    const response = await api.put(`/admin/students/${id}/curriculum`, data);
    return response.data;
};

// ===== 게임 API =====

export const getGameWords = async (bookName, start, end) => {
    const response = await api.get(`/words/game`, { params: { bookName, start, end } });
    return response.data;
};

export const getRewardSettings = async () => {
    const response = await api.get('/settings/rewards');
    return response.data;
};

export const getDailyGameEarnings = async (userId) => {
    const response = await api.get(`/dollars/today`, { params: { userId } });
    return response.data;
};

export const addReward = async (userId, amount, reason, type) => {
    const response = await api.post('/dollars/reward', { userId, amount, reason, type });
    return response.data;
};

// ===== 메신저 API =====

export const getChats = async (userId, role) => {
    const response = await api.get('/chats', { params: { userId, role } });
    return response.data;
};

export const createChat = async (studentId, teacherId, academyId) => {
    const response = await api.post('/chats', { studentId, teacherId, academyId });
    return response.data;
};

export const getMessages = async (chatId) => {
    const response = await api.get(`/chats/${chatId}/messages`);
    return response.data;
};

export const sendMessage = async (chatId, senderId, content, role) => {
    const response = await api.post(`/chats/${chatId}/messages`, { senderId, content, role });
    return response.data;
};

// ... (previous code)

export const markChatRead = async (chatId, userId, role) => {
    const response = await api.put(`/chats/${chatId}/read`, { userId, role });
    return response.data;
};

// ===== 슈퍼 관리자 API =====

export const getSuperStats = async () => {
    const response = await api.get('/super/stats');
    return response.data;
};

export const getAcademies = async () => {
    const response = await api.get('/super/academies');
    return response.data;
};

export const addAcademy = async (academyData) => {
    const response = await api.post('/super/academies', academyData);
    return response.data;
};

// ... (previous code)

export const deleteAcademy = async (id) => {
    const response = await api.delete(`/super/academies/${id}`);
    return response.data;
};

// ===== 학습 페이지 API =====

export const getStudyWords = async (bookName, start, end) => {
    const response = await api.get('/study/words', {
        params: { bookName, start, end }
    });
    return response.data;
};

export const getUserSettings = async (userId) => {
    const response = await api.get(`/users/${userId}/settings`);
    return response.data;
};

export const updateUserSettings = async (userId, settings) => {
    const response = await api.put(`/users/${userId}/settings`, settings);
    return response.data;
};

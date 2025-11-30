import axios from 'axios';
import io from 'socket.io-client';

// 백엔드 API 주소 (개발 환경: localhost:3000)
const API_URL = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000';

// Axios 인스턴스 생성
export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Socket.io 연결
export const socket = io(SOCKET_URL, {
    transports: ['websocket'], // 폴링 방지
    autoConnect: true,
});

// API 함수 예시
export const getWords = async (page = 1, limit = 50) => {
    try {
        const response = await api.get(`/words?page=${page}&limit=${limit}`);
        return response.data;
    } catch (error) {
        console.error('단어 목록 조회 실패:', error);
        throw error;
    }
};

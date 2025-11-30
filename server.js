const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const oracledb = require('oracledb');
require('dotenv').config();
const { getConnection } = require('./db/dbConfig');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // 개발 중에는 모든 출처 허용
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(express.json());
app.use(express.static('client/build')); // React 빌드 결과물 서빙 예정

// 기본 라우트 (상태 확인용)
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', time: new Date() });
});

// 단어 목록 조회 (페이지네이션)
app.get('/api/words', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    let connection;
    try {
        connection = await getConnection();

        // 전체 개수 조회
        const countResult = await connection.execute(
            `SELECT COUNT(*) AS total FROM words`
        );
        const total = countResult.rows[0][0];

        // 데이터 조회
        const result = await connection.execute(
            `SELECT * FROM words 
       ORDER BY id ASC 
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
            { offset, limit },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json({
            data: result.rows,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        console.error('단어 조회 실패:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('연결 종료 오류:', err);
            }
        }
    }
});

// Socket.io 이벤트 처리
io.on('connection', (socket) => {
    console.log('새로운 사용자 접속:', socket.id);

    socket.on('disconnect', () => {
        console.log('사용자 접속 해제:', socket.id);
    });

    // 게임 방 입장
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`사용자 ${socket.id}가 방 ${roomId}에 입장했습니다.`);
        io.to(roomId).emit('player_joined', { id: socket.id });
    });
});

// 서버 시작
server.listen(PORT, async () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);

    // DB 연결 확인
    try {
        const conn = await getConnection();
        console.log('✅ 오라클 DB 연결 성공!');
        await conn.close();
    } catch (err) {
        console.error('❌ 오라클 DB 연결 실패:', err.message);
    }
});

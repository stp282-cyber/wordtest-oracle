const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const oracledb = require('oracledb');
const bcrypt = require('bcrypt');
require('dotenv').config();
const { getConnection } = require('./db/dbConfig');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

const PORT = process.env.PORT || 3000;

// 미들웨어
// CORS 설정
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());
app.use(express.static('client/build'));

// ===== 기본 API =====

app.get('/api/status', (req, res) => {
    res.json({ status: 'online', time: new Date() });
});

// Login API
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt:', { email, password }); // Debug log

    let connection;
    try {
        connection = await getConnection();

        // Find user by id (username)
        const result = await connection.execute(
            `SELECT * FROM users WHERE id = :id`,
            [email],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('DB Result:', result.rows); // Debug log

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Compare password with bcrypt
        const passwordMatch = await bcrypt.compare(password, user.PASSWORD || user.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Return user info (excluding password)
        res.json({
            user: {
                id: user.ID || user.id,
                username: user.USERNAME || user.username,
                role: user.ROLE || user.role,
                email: user.EMAIL || user.email
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        if (connection) await connection.close();
    }
});

// 단어 목록 조회 (페이지네이션)
app.get('/api/words', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    let connection;
    try {
        connection = await getConnection();
        const countResult = await connection.execute(`SELECT COUNT(*) AS total FROM words`);
        const total = countResult.rows[0][0];

        let query = `SELECT * FROM words`;
        const params = {};
        const filters = [];

        if (req.query.book_name) {
            filters.push(`book_name = :book_name`);
            params.book_name = req.query.book_name;
        }
        if (req.query.unit_name) {
            filters.push(`unit_name = :unit_name`);
            params.unit_name = req.query.unit_name;
        }

        if (filters.length > 0) {
            query += ` WHERE ` + filters.join(' AND ');
        }

        query += ` ORDER BY book_name ASC, unit_name ASC, word_order ASC, id ASC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
        params.offset = offset;
        params.limit = limit;

        const result = await connection.execute(
            query,
            params,
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json({
            data: result.rows,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (err) {
        console.error('단어 조회 실패:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

// 단어 추가
app.post('/api/words', async (req, res) => {
    const { english, korean, level_group, book_name, unit_name, word_order } = req.body;
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `INSERT INTO words (english, korean, level_group, book_name, unit_name, word_order) 
             VALUES (:english, :korean, :level_group, :book_name, :unit_name, :word_order)`,
            {
                english,
                korean,
                level_group,
                book_name: book_name || '기본 단어장',
                unit_name: unit_name || '기본 단원',
                word_order: word_order || null
            },
            { autoCommit: true }
        );
        res.json({ success: true, id: result.lastRowid });
    } catch (err) {
        console.error('단어 추가 실패:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

// 단어 수정
app.put('/api/words/:id', async (req, res) => {
    const { id } = req.params;
    const { english, korean, level_group, book_name, unit_name, word_order } = req.body;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `UPDATE words SET english = :english, korean = :korean, level_group = :level_group, 
             book_name = :book_name, unit_name = :unit_name, word_order = :word_order 
             WHERE id = :id`,
            {
                english,
                korean,
                level_group,
                book_name: book_name || '기본 단어장',
                unit_name: unit_name || '기본 단원',
                word_order: word_order || null,
                id
            },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('단어 수정 실패:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

// 단어 일괄 삭제 (단어장별) - MUST come before /api/words/:id
app.delete('/api/words/batch', async (req, res) => {
    const { book_name } = req.query;
    if (!book_name) {
        return res.status(400).json({ error: 'Book name is required' });
    }
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `DELETE FROM words WHERE book_name = :book_name`,
            { book_name },
            { autoCommit: true }
        );
        res.json({ success: true, count: result.rowsAffected });
    } catch (err) {
        console.error('단어 일괄 삭제 실패:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

// 단어 삭제
app.delete('/api/words/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `DELETE FROM words WHERE id = :id`,
            { id },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('단어 삭제 실패:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

// ===== 인증 API =====

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT id, username, role, email FROM users WHERE email = :email AND password = :password`,
            { email, password },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 잘못되었습니다.' });
        }
    } catch (err) {
        console.error('로그인 오류:', err);
        res.status(500).json({ error: '서버 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

// ===== 학생 API =====

app.get('/api/history/:userId', async (req, res) => {
    const { userId } = req.params;
    let connection;
    try {
        connection = await getConnection();

        const testResult = await connection.execute(
            `SELECT * FROM test_results WHERE user_id = :userId ORDER BY date_taken DESC FETCH FIRST 50 ROWS ONLY`,
            { userId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const dollarResult = await connection.execute(
            `SELECT * FROM dollar_history WHERE user_id = :userId ORDER BY date_earned DESC FETCH FIRST 50 ROWS ONLY`,
            { userId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json({ tests: testResult.rows, dollars: dollarResult.rows });
    } catch (err) {
        console.error('학습 기록 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

app.post('/api/test-results', async (req, res) => {
    const { id, userId, score, total, correct, wrong, details } = req.body;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `INSERT INTO test_results (id, user_id, score, total_questions, correct_answers, wrong_answers, details)
             VALUES (:id, :userId, :score, :total, :correct, :wrong, :details)`,
            { id, userId, score, total, correct, wrong, details: JSON.stringify(details) },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('시험 결과 저장 오류:', err);
        res.status(500).json({ error: '저장 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

app.get('/api/dashboard/student/:userId', async (req, res) => {
    const { userId } = req.params;
    let connection;
    try {
        connection = await getConnection();

        const userResult = await connection.execute(
            `SELECT * FROM users WHERE id = :userId`,
            { userId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const historyResult = await connection.execute(
            `SELECT * FROM test_results WHERE user_id = :userId ORDER BY date_taken DESC FETCH FIRST 5 ROWS ONLY`,
            { userId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json({ user: userResult.rows[0], history: historyResult.rows, announcements: [] });
    } catch (err) {
        console.error('대시보드 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

// ===== 관리자 API =====

// 학생 관리
app.get('/api/admin/students', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT id, username, email, role, created_at FROM users WHERE role = 'student' ORDER BY created_at DESC`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        console.error('학생 목록 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

app.post('/api/admin/students', async (req, res) => {
    const { id, username, email, password } = req.body;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `INSERT INTO users (id, username, email, password, role)
             VALUES (:id, :username, :email, :password, 'student')`,
            { id, username, email, password: password || '1234' },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('학생 추가 오류:', err);
        res.status(500).json({ error: '학생 추가 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

app.put('/api/admin/students/:id', async (req, res) => {
    const { id } = req.params;
    const { username, email } = req.body;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `UPDATE users SET username = :username, email = :email WHERE id = :id`,
            { id, username, email },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('학생 수정 오류:', err);
        res.status(500).json({ error: '학생 수정 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

app.delete('/api/admin/students/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `DELETE FROM users WHERE id = :id`,
            { id },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('학생 삭제 오류:', err);
        res.status(500).json({ error: '학생 삭제 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

// 단어 관리 (관리자용)
app.get('/api/admin/words', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT * FROM words ORDER BY id ASC`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        console.error('단어 목록 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

// ===== 설정 API =====

app.get('/api/settings/:key', async (req, res) => {
    const { key } = req.params;
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT value FROM settings WHERE key = :key`,
            { key },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length > 0) {
            res.json(JSON.parse(result.rows[0].VALUE));
        } else {
            res.json({}); // 설정이 없으면 빈 객체 반환
        }
    } catch (err) {
        console.error('설정 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

app.post('/api/settings/:key', async (req, res) => {
    const { key } = req.params;
    const settings = req.body;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `MERGE INTO settings s
             USING (SELECT :key AS key, :value AS value FROM dual) src
             ON (s.key = src.key)
             WHEN MATCHED THEN UPDATE SET value = src.value
             WHEN NOT MATCHED THEN INSERT (key, value) VALUES (src.key, src.value)`,
            {
                key,
                value: JSON.stringify(settings)
            },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('설정 저장 오류:', err);
        res.status(500).json({ error: '설정 저장 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

// ===== 공지사항 API =====

app.get('/api/announcements', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT * FROM announcements ORDER BY created_at DESC FETCH FIRST 20 ROWS ONLY`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        console.error('공지사항 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

app.post('/api/announcements', async (req, res) => {
    const { title, content, targetClassId, targetClassName, authorName } = req.body;
    const id = Date.now().toString(); // 간단한 ID 생성
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `INSERT INTO announcements (id, title, content, target_class_id, target_class_name, author_name)
             VALUES (:id, :title, :content, :targetClassId, :targetClassName, :authorName)`,
            { id, title, content, targetClassId, targetClassName, authorName },
            { autoCommit: true }
        );
        res.json({ success: true, id });
    } catch (err) {
        console.error('공지사항 추가 오류:', err);
        res.status(500).json({ error: '공지사항 추가 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

app.delete('/api/announcements/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `DELETE FROM announcements WHERE id = :id`,
            { id },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('공지사항 삭제 오류:', err);
        res.status(500).json({ error: '공지사항 삭제 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

// ===== 반(Class) API =====

app.get('/api/classes', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT * FROM classes ORDER BY created_at DESC`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        console.error('반 목록 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

app.post('/api/classes', async (req, res) => {
    const { name } = req.body;
    const id = Date.now().toString();
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `INSERT INTO classes (id, name) VALUES (:id, :name)`,
            { id, name },
            { autoCommit: true }
        );
        res.json({ success: true, id });
    } catch (err) {
        console.error('반 추가 오류:', err);
        res.status(500).json({ error: '반 추가 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

app.delete('/api/classes/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await getConnection();
        // 반 삭제 시 해당 반에 속한 학생들의 class_id를 NULL로 업데이트 (선택 사항)
        await connection.execute(
            `UPDATE users SET class_id = NULL WHERE class_id = :id`,
            { id },
            { autoCommit: false } // 트랜잭션 묶음
        );

        await connection.execute(
            `DELETE FROM classes WHERE id = :id`,
            { id },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('반 삭제 오류:', err);
        res.status(500).json({ error: '반 삭제 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

// ===== 커리큘럼 및 학생 상세 정보 API =====

// 학생 상세 정보 조회 (커리큘럼 포함)
app.get('/api/admin/students/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT id, username, name, email, role, class_id, curriculum_data, created_at FROM users WHERE id = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length > 0) {
            const student = result.rows[0];
            // CLOB 데이터를 JSON으로 파싱
            if (student.CURRICULUM_DATA) {
                try {
                    // Oracle DB 드라이버 버전에 따라 CLOB 처리가 다를 수 있음.
                    // fetchAsString 옵션이 없으면 Stream일 수 있으나, 현재 설정상 문자열로 올 가능성 높음.
                    // 만약 객체라면 getData() 등을 써야 할 수도 있음.
                    // 여기서는 간단히 문자열로 가정하고 파싱 시도.
                    let clobData = student.CURRICULUM_DATA;
                    // 만약 clobData가 Lob 객체라면 읽어야 함 (생략, 보통 fetchAsString 설정 권장)
                    student.curriculum_data = JSON.parse(clobData);
                } catch (e) {
                    console.error('JSON 파싱 오류:', e);
                    student.curriculum_data = {};
                }
            } else {
                student.curriculum_data = {};
            }
            res.json(student);
        } else {
            res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
        }
    } catch (err) {
        console.error('학생 상세 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

// 학생 커리큘럼 및 정보 업데이트
app.put('/api/admin/students/:id/curriculum', async (req, res) => {
    const { id } = req.params;
    const { class_id, curriculum_data } = req.body;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `UPDATE users SET class_id = :class_id, curriculum_data = :curriculum_data WHERE id = :id`,
            {
                class_id: class_id || null,
                curriculum_data: JSON.stringify(curriculum_data || {}),
                id
            },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('커리큘럼 업데이트 오류:', err);
        res.status(500).json({ error: '업데이트 실패' });
        if (connection) await connection.close();
    }
});

// ===== 공지사항 API =====

app.get('/api/announcements', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT * FROM announcements ORDER BY created_at DESC FETCH FIRST 20 ROWS ONLY`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        console.error('공지사항 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

app.post('/api/announcements', async (req, res) => {
    const { title, content, targetClassId, targetClassName, authorName } = req.body;
    const id = Date.now().toString(); // 간단한 ID 생성
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `INSERT INTO announcements (id, title, content, target_class_id, target_class_name, author_name)
             VALUES (:id, :title, :content, :targetClassId, :targetClassName, :authorName)`,
            { id, title, content, targetClassId, targetClassName, authorName },
            { autoCommit: true }
        );
        res.json({ success: true, id });
    } catch (err) {
        console.error('공지사항 추가 오류:', err);
        res.status(500).json({ error: '공지사항 추가 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

app.delete('/api/announcements/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `DELETE FROM announcements WHERE id = :id`,
            { id },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('공지사항 삭제 오류:', err);
        res.status(500).json({ error: '공지사항 삭제 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

// ===== 반(Class) API =====

app.get('/api/classes', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT * FROM classes ORDER BY created_at DESC`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        console.error('반 목록 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

app.post('/api/classes', async (req, res) => {
    const { name } = req.body;
    const id = Date.now().toString();
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `INSERT INTO classes (id, name) VALUES (:id, :name)`,
            { id, name },
            { autoCommit: true }
        );
        res.json({ success: true, id });
    } catch (err) {
        console.error('반 추가 오류:', err);
        res.status(500).json({ error: '반 추가 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

app.delete('/api/classes/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await getConnection();
        // 반 삭제 시 해당 반에 속한 학생들의 class_id를 NULL로 업데이트 (선택 사항)
        await connection.execute(
            `UPDATE users SET class_id = NULL WHERE class_id = :id`,
            { id },
            { autoCommit: false } // 트랜잭션 묶음
        );

        await connection.execute(
            `DELETE FROM classes WHERE id = :id`,
            { id },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('반 삭제 오류:', err);
        res.status(500).json({ error: '반 삭제 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

// ===== 커리큘럼 및 학생 상세 정보 API =====

// 학생 상세 정보 조회 (커리큘럼 포함)
app.get('/api/admin/students/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT id, username, name, email, role, class_id, curriculum_data, created_at FROM users WHERE id = :id`,
            { id },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length > 0) {
            const student = result.rows[0];
            // CLOB 데이터를 JSON으로 파싱
            if (student.CURRICULUM_DATA) {
                try {
                    // Oracle DB 드라이버 버전에 따라 CLOB 처리가 다를 수 있음.
                    // fetchAsString 옵션이 없으면 Stream일 수 있으나, 현재 설정상 문자열로 올 가능성 높음.
                    // 만약 객체라면 getData() 등을 써야 할 수도 있음.
                    // 여기서는 간단히 문자열로 가정하고 파싱 시도.
                    let clobData = student.CURRICULUM_DATA;
                    // 만약 clobData가 Lob 객체라면 읽어야 함 (생략, 보통 fetchAsString 설정 권장)
                    student.curriculum_data = JSON.parse(clobData);
                } catch (e) {
                    console.error('JSON 파싱 오류:', e);
                    student.curriculum_data = {};
                }
            } else {
                student.curriculum_data = {};
            }
            res.json(student);
        } else {
            res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
        }
    } catch (err) {
        console.error('학생 상세 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

// 학생 커리큘럼 및 정보 업데이트
app.put('/api/admin/students/:id/curriculum', async (req, res) => {
    const { id } = req.params;
    const { class_id, curriculum_data } = req.body;
    let connection;
    try {
        connection = await getConnection();
        await connection.execute(
            `UPDATE users SET class_id = :class_id, curriculum_data = :curriculum_data WHERE id = :id`,
            {
                class_id: class_id || null,
                curriculum_data: JSON.stringify(curriculum_data || {}),
                id
            },
            { autoCommit: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('커리큘럼 업데이트 오류:', err);
        res.status(500).json({ error: '업데이트 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

// ===== 게임 API =====

app.get('/api/words/game', async (req, res) => {
    const { bookName, start, end } = req.query;
    let connection;
    try {
        connection = await getConnection();
        let query = `SELECT * FROM words`;
        const params = {};

        if (bookName) {
            // Note: Assuming 'book_name' column exists or mapping logic needed. 
            // If book_name is not in schema, we might need to adjust.
            // For now, let's assume filtering by ID range is the primary method as per previous context.
            // If bookName is strictly required, we'd need a column. 
            // Based on previous context, we might just filter by ID range if bookName logic isn't ready.
            // However, let's implement ID range filtering which is common.
        }

        if (start && end) {
            query += ` WHERE id BETWEEN :startId AND :endId`;
            params.startId = parseInt(start);
            params.endId = parseInt(end);
        }

        // Randomize order for game
        // Oracle random order: ORDER BY dbms_random.value
        query += ` ORDER BY dbms_random.value FETCH FIRST 50 ROWS ONLY`;

        const result = await connection.execute(
            query,
            params,
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        console.error('게임 단어 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

app.get('/api/settings/rewards', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT value FROM settings WHERE key = 'rewards'`,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length > 0) {
            res.json(JSON.parse(result.rows[0].VALUE));
        } else {
            // Default rewards
            res.json({
                game_high_score_reward: 100,
                game_daily_max_reward: 500
            });
        }
    } catch (err) {
        console.error('보상 설정 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

app.get('/api/dollars/today', async (req, res) => {
    const { userId } = req.query;
    let connection;
    try {
        connection = await getConnection();
        // Calculate total earned today from dollar_history
        const result = await connection.execute(
            `SELECT SUM(amount) AS total FROM dollar_history 
             WHERE user_id = :userId 
             AND TRUNC(date_earned) = TRUNC(CURRENT_DATE)
             AND type = 'game_reward'`,
            { userId },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        res.json({ total: result.rows[0].TOTAL || 0 });
    } catch (err) {
        console.error('오늘 획득 보상 조회 오류:', err);
        res.status(500).json({ error: '데이터베이스 오류' });
    } finally {
        if (connection) await connection.close();
    }
});

app.post('/api/dollars/reward', async (req, res) => {
    const { userId, amount, reason, type } = req.body;
    const id = Date.now().toString();
    let connection;
    try {
        connection = await getConnection();

        // 1. Update User Balance
        await connection.execute(
            `UPDATE users SET dollar_balance = dollar_balance + :amount WHERE id = :userId`,
            { amount, userId },
            { autoCommit: false }
        );

        // 2. Add History Record
        await connection.execute(
            `INSERT INTO dollar_history (id, user_id, amount, reason, type, date_earned)
             VALUES (:id, :userId, :amount, :reason, :type, CURRENT_TIMESTAMP)`,
            { id, userId, amount, reason, type: type || 'game_reward' },
            { autoCommit: false }
        );

        await connection.commit();
        res.json({ success: true, newBalance: 0 }); // Client might need to refetch user to get exact balance
    } catch (err) {
        console.error('보상 지급 오류:', err);
        if (connection) await connection.rollback();
        res.status(500).json({ error: '보상 지급 실패' });
    } finally {
        if (connection) await connection.close();
    }
});

// --- Messenger APIs ---

// Get Chats List
app.get('/api/chats', async (req, res) => {
    const { userId, role } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    let connection;
    try {
        connection = await getConnection();
        let query = '';
        let params = [userId];

        if (role === 'admin' || role === 'super_admin') {
            // Admin sees chats where they are the teacher
            query = `
                SELECT c.*, 
                       u_student.name as student_name, 
                       u_teacher.name as teacher_name 
                FROM chats c
                JOIN users u_student ON c.student_id = u_student.id
                JOIN users u_teacher ON c.teacher_id = u_teacher.id
                WHERE c.teacher_id = :userId
                ORDER BY c.updated_at DESC
            `;
        } else {
            // Student sees only their chats
            query = `
                SELECT c.*, 
                       u_student.name as student_name, 
                       u_teacher.name as teacher_name 
                FROM chats c
                JOIN users u_student ON c.student_id = u_student.id
                JOIN users u_teacher ON c.teacher_id = u_teacher.id
                WHERE c.student_id = :userId
                ORDER BY c.updated_at DESC
            `;
        }

        const result = await connection.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching chats:', err);
        res.status(500).json({ error: 'Failed to fetch chats' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// Create Chat
app.post('/api/chats', async (req, res) => {
    const { studentId, teacherId, academyId } = req.body;
    const id = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let connection;
    try {
        connection = await getConnection();

        // Check if chat already exists
        const checkResult = await connection.execute(
            `SELECT id FROM chats WHERE student_id = :studentId AND teacher_id = :teacherId`,
            [studentId, teacherId],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (checkResult.rows.length > 0) {
            return res.json({ id: checkResult.rows[0].ID, exists: true });
        }

        await connection.execute(
            `INSERT INTO chats (id, student_id, teacher_id, academy_id, last_message, updated_at) 
             VALUES (:id, :studentId, :teacherId, :academyId, '대화를 시작해보세요!', CURRENT_TIMESTAMP)`,
            { id, studentId, teacherId, academyId: academyId || 'academy_default' },
            { autoCommit: true }
        );

        res.json({ id, exists: false });
    } catch (err) {
        console.error('Error creating chat:', err);
        res.status(500).json({ error: 'Failed to create chat' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// Get Messages
app.get('/api/chats/:chatId/messages', async (req, res) => {
    const { chatId } = req.params;
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT m.*, u.name as sender_name 
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.chat_id = :chatId
             ORDER BY m.created_at ASC
             FETCH FIRST 50 ROWS ONLY`, // Limit for now
            [chatId],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// Send Message
app.post('/api/chats/:chatId/messages', async (req, res) => {
    const { chatId } = req.params;
    const { senderId, content, role } = req.body;
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let connection;
    try {
        connection = await getConnection();

        // Insert message
        await connection.execute(
            `INSERT INTO messages (id, chat_id, sender_id, content, created_at) 
             VALUES (:id, :chatId, :senderId, :content, CURRENT_TIMESTAMP)`,
            { id, chatId, senderId, content },
            { autoCommit: false }
        );

        // Update chat (last_message, updated_at, unread_count)
        let updateQuery = '';
        if (role === 'admin' || role === 'super_admin') {
            // Teacher sent message -> increment student unread
            updateQuery = `UPDATE chats SET last_message = :content, updated_at = CURRENT_TIMESTAMP, unread_student = unread_student + 1 WHERE id = :chatId`;
        } else {
            // Student sent message -> increment teacher unread
            updateQuery = `UPDATE chats SET last_message = :content, updated_at = CURRENT_TIMESTAMP, unread_teacher = unread_teacher + 1 WHERE id = :chatId`;
        }

        await connection.execute(updateQuery, { content, chatId }, { autoCommit: false });

        await connection.commit();
        res.json({ success: true, id });

    } catch (err) {
        console.error('Error sending message:', err);
        if (connection) {
            try {
                await connection.rollback();
            } catch (rbErr) {
                console.error(rbErr);
            }
        }
        res.status(500).json({ error: 'Failed to send message' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// Mark as Read
app.put('/api/chats/:chatId/read', async (req, res) => {
    const { chatId } = req.params;
    const { userId, role } = req.body;

    let connection;
    try {
        connection = await getConnection();

        let updateQuery = '';
        if (role === 'admin' || role === 'super_admin') {
            // Teacher reading -> clear teacher unread
            updateQuery = `UPDATE chats SET unread_teacher = 0 WHERE id = :chatId`;
        } else {
            // Student reading -> clear student unread
            updateQuery = `UPDATE chats SET unread_student = 0 WHERE id = :chatId`;
        }

        await connection.execute(updateQuery, [chatId], { autoCommit: true });
        res.json({ success: true });

    } catch (err) {
        console.error('Error marking read:', err);
        res.status(500).json({ error: 'Failed to mark read' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// ===== Socket.io =====

io.on('connection', (socket) => {
    console.log('새로운 사용자 접속:', socket.id);

    socket.on('disconnect', () => {
        console.log('사용자 접속 해제:', socket.id);
    });
});

// Get Chats
app.get('/api/chats', async (req, res) => {
    const { userId, role } = req.query;
    let connection;
    try {
        connection = await getConnection();
        let query;
        let params;

        if (role === 'admin' || role === 'super_admin') {
            query = `
                SELECT c.*, 
                       u_student.name as student_name, 
                       u_teacher.name as teacher_name 
                FROM chats c
                JOIN users u_student ON c.student_id = u_student.id
                JOIN users u_teacher ON c.teacher_id = u_teacher.id
                ORDER BY c.updated_at DESC
            `;
            params = [];
        } else {
            query = `
                SELECT c.*, 
                       u_student.name as student_name, 
                       u_teacher.name as teacher_name 
                FROM chats c
                JOIN users u_student ON c.student_id = u_student.id
                JOIN users u_teacher ON c.teacher_id = u_teacher.id
                WHERE c.student_id = :userId
                ORDER BY c.updated_at DESC
            `;
            params = [userId];
        }

        const result = await connection.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching chats:', err);
        res.status(500).json({ error: 'Failed to fetch chats' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// Create Chat
app.post('/api/chats', async (req, res) => {
    const { studentId, teacherId, academyId } = req.body;
    const id = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)} `;

    let connection;
    try {
        connection = await getConnection();

        // Check if chat already exists
        const checkResult = await connection.execute(
            `SELECT id FROM chats WHERE student_id = :studentId AND teacher_id = : teacherId`,
            [studentId, teacherId],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (checkResult.rows.length > 0) {
            return res.json({ id: checkResult.rows[0].ID, exists: true });
        }

        await connection.execute(
            `INSERT INTO chats(id, student_id, teacher_id, academy_id, last_message, updated_at)
    VALUES(: id, : studentId, : teacherId, : academyId, '대화를 시작해보세요!', CURRENT_TIMESTAMP)`,
            { id, studentId, teacherId, academyId: academyId || 'academy_default' },
            { autoCommit: true }
        );

        res.json({ id, exists: false });
    } catch (err) {
        console.error('Error creating chat:', err);
        res.status(500).json({ error: 'Failed to create chat' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// Get Messages
app.get('/api/chats/:chatId/messages', async (req, res) => {
    const { chatId } = req.params;
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT m.*, u.name as sender_name 
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.chat_id = : chatId
             ORDER BY m.created_at ASC
             FETCH FIRST 50 ROWS ONLY`, // Limit for now
            [chatId],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// Send Message
app.post('/api/chats/:chatId/messages', async (req, res) => {
    const { chatId } = req.params;
    const { senderId, content, role } = req.body;
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)} `;

    let connection;
    try {
        connection = await getConnection();

        // Insert message
        await connection.execute(
            `INSERT INTO messages(id, chat_id, sender_id, content, created_at)
    VALUES(: id, : chatId, : senderId, : content, CURRENT_TIMESTAMP)`,
            { id, chatId, senderId, content },
            { autoCommit: false }
        );

        // Update chat (last_message, updated_at, unread_count)
        let updateQuery = '';
        if (role === 'admin' || role === 'super_admin') {
            // Teacher sent message -> increment student unread
            updateQuery = `UPDATE chats SET last_message = : content, updated_at = CURRENT_TIMESTAMP, unread_student = unread_student + 1 WHERE id = : chatId`;
        } else {
            // Student sent message -> increment teacher unread
            updateQuery = `UPDATE chats SET last_message = : content, updated_at = CURRENT_TIMESTAMP, unread_teacher = unread_teacher + 1 WHERE id = : chatId`;
        }

        await connection.execute(updateQuery, { content, chatId }, { autoCommit: false });

        await connection.commit();
        res.json({ success: true, id });

    } catch (err) {
        console.error('Error sending message:', err);
        if (connection) {
            try {
                await connection.rollback();
            } catch (rbErr) {
                console.error(rbErr);
            }
        }
        res.status(500).json({ error: 'Failed to send message' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// Mark as Read
app.put('/api/chats/:chatId/read', async (req, res) => {
    const { chatId } = req.params;
    const { userId, role } = req.body;

    let connection;
    try {
        connection = await getConnection();

        let updateQuery = '';
        if (role === 'admin' || role === 'super_admin') {
            // Teacher reading -> clear teacher unread
            updateQuery = `UPDATE chats SET unread_teacher = 0 WHERE id = : chatId`;
        } else {
            // Student reading -> clear student unread
            updateQuery = `UPDATE chats SET unread_student = 0 WHERE id = : chatId`;
        }

        await connection.execute(updateQuery, [chatId], { autoCommit: true });
        res.json({ success: true });

    } catch (err) {
        console.error('Error marking read:', err);
        res.status(500).json({ error: 'Failed to mark read' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// ===== Socket.io =====

io.on('connection', (socket) => {
    console.log('새로운 사용자 접속:', socket.id);

    socket.on('disconnect', () => {
        console.log('사용자 접속 해제:', socket.id);
    });

    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`사용자 ${socket.id}가 방 ${roomId}에 입장했습니다.`);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});

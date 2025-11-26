const db = require('../db/database');
const bcrypt = require('bcryptjs');

async function seed() {
    console.log("Seeding database...");

    // 1. Create Admin
    const adminHash = await bcrypt.hash('admin123', 10);
    try {
        db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run('admin', adminHash, 'admin');
        console.log("Admin created: admin / admin123");
    } catch (e) {
        console.log("Admin already exists (or error):", e.message);
    }

    // 2. Create Student
    const studentHash = await bcrypt.hash('student123', 10);
    try {
        const info = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run('student', studentHash, 'student');
        db.prepare("INSERT INTO settings (user_id) VALUES (?)").run(info.lastInsertRowid);
        console.log("Student created: student / student123");
    } catch (e) {
        console.log("Student already exists (or error):", e.message);
    }

    // 3. Seed Words (50 words)
    const words = [
        { en: 'apple', ko: '사과' }, { en: 'banana', ko: '바나나' }, { en: 'cat', ko: '고양이' }, { en: 'dog', ko: '개' },
        { en: 'elephant', ko: '코끼리' }, { en: 'flower', ko: '꽃' }, { en: 'grape', ko: '포도' }, { en: 'house', ko: '집' },
        { en: 'ice cream', ko: '아이스크림' }, { en: 'jungle', ko: '정글' }, { en: 'kite', ko: '연' }, { en: 'lion', ko: '사자' },
        { en: 'monkey', ko: '원숭이' }, { en: 'nest', ko: '둥지' }, { en: 'orange', ko: '오렌지' }, { en: 'piano', ko: '피아노' },
        { en: 'queen', ko: '여왕' }, { en: 'rabbit', ko: '토끼' }, { en: 'sun', ko: '태양' }, { en: 'tree', ko: '나무' },
        { en: 'umbrella', ko: '우산' }, { en: 'violin', ko: '바이올린' }, { en: 'water', ko: '물' }, { en: 'xylophone', ko: '실로폰' },
        { en: 'yacht', ko: '요트' }, { en: 'zebra', ko: '얼룩말' }, { en: 'ant', ko: '개미' }, { en: 'bear', ko: '곰' },
        { en: 'car', ko: '자동차' }, { en: 'desk', ko: '책상' }, { en: 'egg', ko: '달걀' }, { en: 'fish', ko: '물고기' },
        { en: 'goat', ko: '염소' }, { en: 'hat', ko: '모자' }, { en: 'ink', ko: '잉크' }, { en: 'jam', ko: '잼' },
        { en: 'king', ko: '왕' }, { en: 'lemon', ko: '레몬' }, { en: 'moon', ko: '달' }, { en: 'nurse', ko: '간호사' },
        { en: 'owl', ko: '부엉이' }, { en: 'pig', ko: '돼지' }, { en: 'quiet', ko: '조용한' }, { en: 'rose', ko: '장미' },
        { en: 'star', ko: '별' }, { en: 'train', ko: '기차' }, { en: 'uniform', ko: '유니폼' }, { en: 'van', ko: '밴' },
        { en: 'wolf', ko: '늑대' }, { en: 'box', ko: '상자' }
    ];

    const insert = db.prepare("INSERT INTO words (english, korean) VALUES (?, ?)");
    const insertMany = db.transaction((words) => {
        for (const w of words) insert.run(w.en, w.ko);
    });

    try {
        // Check if words exist
        const count = db.prepare("SELECT count(*) as c FROM words").get().c;
        if (count === 0) {
            insertMany(words);
            console.log(`Seeded ${words.length} words.`);
        } else {
            console.log("Words already exist, skipping seed.");
        }
    } catch (e) {
        console.error("Error seeding words:", e);
    }
}

seed();

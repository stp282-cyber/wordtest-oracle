# Wordtest Oracle - Oracle Cloud Migration

Firebase 기반 애플리케이션을 Oracle Cloud Free Tier로 마이그레이션한 프로젝트입니다.

## 기술 스택

### 백엔드
- Node.js + Express
- Oracle Autonomous Database (ATP)
- Socket.io (실시간 통신)
- node-oracledb (Thin 모드)

### 프론트엔드
- React + Vite
- Axios (API 클라이언트)
- Socket.io Client
- TailwindCSS

## 로컬 개발 환경 설정

### 1. 사전 요구사항
- Node.js 20.x 이상
- Oracle Cloud 계정 (Free Tier)
- Oracle ATP 데이터베이스
- 데이터베이스 Wallet 파일

### 2. 설치

```bash
# 의존성 설치
npm install

# 클라이언트 의존성 설치
cd client
npm install
cd ..
```

### 3. 환경 변수 설정

`.env` 파일 생성:
```env
DB_USER=ADMIN
DB_PASSWORD=<YOUR_ADMIN_PASSWORD>
DB_WALLET_PASSWORD=<YOUR_WALLET_PASSWORD>
DB_CONNECT_STRING=wordtest_high
PORT=3000
```

### 4. Wallet 파일 설정

1. Oracle Cloud에서 Wallet 다운로드
2. `wallet/` 폴더에 압축 해제
3. 필수 파일: `cwallet.sso`, `ewallet.p12`, `tnsnames.ora`, `sqlnet.ora`

### 5. 데이터베이스 초기화

```bash
node init_db.js
```

### 6. 서버 실행

```bash
# 백엔드 서버
node server.js

# 프론트엔드 (새 터미널)
cd client
npm run dev
```

접속: http://localhost:5173

## 배포

자세한 배포 가이드는 `hosting_guide.md`를 참조하세요.

## 프로젝트 구조

```
wordtest-oracle/
├── db/
│   ├── dbConfig.js       # DB 연결 설정
│   └── schema.sql        # 테이블 스키마
├── client/               # React 프론트엔드
│   ├── src/
│   │   ├── api/         # API 클라이언트
│   │   ├── pages/       # 페이지 컴포넌트
│   │   └── components/  # 공통 컴포넌트
│   └── package.json
├── wallet/              # Oracle Wallet 파일 (gitignore)
├── server.js            # Express 서버
├── init_db.js           # DB 초기화 스크립트
├── .env                 # 환경 변수 (gitignore)
└── package.json
```

## API 엔드포인트

- `GET /api/status` - 서버 상태 확인
- `GET /api/words?page=1&limit=50` - 단어 목록 조회 (페이지네이션)

## Socket.io 이벤트

- `connection` - 클라이언트 연결
- `disconnect` - 클라이언트 연결 해제
- `join_room` - 게임 방 입장

## 비용

**총 0원** - Oracle Cloud Free Tier 사용
- Oracle ATP: Always Free
- Compute Instance: Always Free (배포 시)

## 라이선스

MIT

#!/bin/bash

# Oracle Cloud VM 자동 배포 스크립트
# 이 스크립트를 VM에서 실행하면 자동으로 애플리케이션이 배포됩니다.

set -e  # 오류 발생 시 중단

echo "================================"
echo "Wordtest Oracle 자동 배포 시작"
echo "================================"

# 1. 시스템 업데이트
echo "[1/8] 시스템 업데이트 중..."
sudo apt update
sudo apt upgrade -y

# 2. Node.js 설치
echo "[2/8] Node.js 설치 중..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v

# 3. Nginx 설치
echo "[3/8] Nginx 설치 중..."
sudo apt install -y nginx

# 4. PM2 설치 (프로세스 관리자)
echo "[4/8] PM2 설치 중..."
sudo npm install -g pm2

# 5. 코드 다운로드
echo "[5/8] GitHub에서 코드 다운로드 중..."
cd /home/ubuntu
git clone https://github.com/stp282-cyber/wordtest-oracle.git
cd wordtest-oracle

# 6. 백엔드 설정
echo "[6/8] 백엔드 의존성 설치 중..."
npm install

# 환경 변수 파일 생성 (사용자가 수동으로 수정해야 함)
cat > .env << 'EOF'
DB_USER=ADMIN
DB_PASSWORD=YOUR_ADMIN_PASSWORD_HERE
DB_WALLET_PASSWORD=YOUR_WALLET_PASSWORD_HERE
DB_CONNECT_STRING=wordtest_high
PORT=3000
EOF

echo "⚠️  .env 파일이 생성되었습니다. 비밀번호를 수정해주세요:"
echo "   nano .env"

# 7. 프론트엔드 빌드
echo "[7/8] 프론트엔드 빌드 중..."
cd client
npm install
npm run build
cd ..

# 8. Nginx 설정
echo "[8/8] Nginx 설정 중..."
sudo tee /etc/nginx/sites-available/wordtest > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    # 프론트엔드 (React 빌드 파일)
    root /home/ubuntu/wordtest-oracle/client/dist;
    index index.html;

    # React Router 지원
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 백엔드 API 프록시
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io 프록시
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/wordtest /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 방화벽 설정
echo "방화벽 설정 중..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

echo ""
echo "================================"
echo "✅ 기본 설정 완료!"
echo "================================"
echo ""
echo "다음 단계:"
echo "1. Wallet 파일 업로드:"
echo "   로컬 PC에서: scp -i <key.pem> -r wallet ubuntu@<VM_IP>:/home/ubuntu/wordtest-oracle/"
echo ""
echo "2. .env 파일 수정:"
echo "   nano /home/ubuntu/wordtest-oracle/.env"
echo "   (DB_PASSWORD와 DB_WALLET_PASSWORD를 실제 값으로 변경)"
echo ""
echo "3. DB 초기화:"
echo "   cd /home/ubuntu/wordtest-oracle"
echo "   node init_db.js"
echo ""
echo "4. 서버 시작:"
echo "   pm2 start server.js --name wordtest-backend"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "5. 브라우저에서 접속:"
echo "   http://<VM_PUBLIC_IP>"
echo ""

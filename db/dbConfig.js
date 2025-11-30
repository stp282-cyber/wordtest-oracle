const oracledb = require('oracledb');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const walletPath = path.join(process.cwd(), 'wallet');

// TNS_ADMIN 설정
process.env.TNS_ADMIN = walletPath;

function getConnectString(alias) {
    try {
        const tnsPath = path.join(walletPath, 'tnsnames.ora');
        if (!fs.existsSync(tnsPath)) {
            console.warn('tnsnames.ora not found, using alias as is.');
            return alias;
        }
        const content = fs.readFileSync(tnsPath, 'utf8');

        const lines = content.split('\n');
        for (let line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith(alias)) {
                const eqIndex = trimmed.indexOf('=');
                if (eqIndex !== -1) {
                    let connStr = trimmed.substring(eqIndex + 1).trim();
                    return connStr;
                }
            }
        }
        return alias;
    } catch (err) {
        console.error('TNS 파싱 오류:', err);
        return alias;
    }
}

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: getConnectString(process.env.DB_CONNECT_STRING),
    walletLocation: walletPath,
};

async function getConnection() {
    try {
        // TNS_ADMIN을 명시적으로 설정 (중요!)
        process.env.TNS_ADMIN = walletPath;

        console.log('Connecting with config:', {
            user: dbConfig.user,
            connectString: dbConfig.connectString ? dbConfig.connectString.substring(0, 50) + '...' : 'undefined',
            walletLocation: dbConfig.walletLocation,
            TNS_ADMIN: process.env.TNS_ADMIN
        });

        const connection = await oracledb.getConnection({
            user: dbConfig.user,
            password: dbConfig.password,
            connectString: dbConfig.connectString,
            walletLocation: dbConfig.walletLocation,
            walletPassword: process.env.DB_WALLET_PASSWORD || dbConfig.password
        });
        return connection;
    } catch (err) {
        console.error('DB 연결 실패:', err);
        throw err;
    }
}

module.exports = { getConnection };

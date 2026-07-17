// =============================================
// Structured Logging (Winston)
// =============================================
// ใช้แทน console.log/console.error ทั่วทั้งแอป
// Log จะเขียนลงไฟล์ตาม date และ level
//
// วิธีใช้ในไฟล์อื่น:
//   const logger = require('./utils/logger');
//   logger.info('User logged in', { username: 'admin', ip: '127.0.0.1' });
//   logger.warn('Login failed', { username: 'test', ip: '192.168.1.1', attempt: 3 });
//   logger.error('Database query failed', { error: err.message, sql: '...' });
//   logger.special('auth_failure', 'Login failed', { username: 'hacker', ip: '...' });
// =============================================

const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// Custom log levels
const levels = {
    error: 0,
    warn: 1,
    auth_failure: 2,  // แยก log สำหรับความล้มเหลวในการ authenticate
    info: 3,
    debug: 4,
};

// Custom colors
winston.addColors({
    error: 'red',
    warn: 'yellow',
    auth_failure: 'magenta',
    info: 'green',
    debug: 'blue',
});

// Log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    })
);

const logger = winston.createLogger({
    levels,
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // Console — แสดงทุกอย่างใน dev
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'HH:mm:ss' }),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
                    return `${timestamp} ${level}: ${message}${metaStr}`;
                })
            )
        }),
        // General log — เขียนลงไฟล์
        new winston.transports.File({
            filename: path.join(logDir, `app-${new Date().toISOString().slice(0,10)}.log`),
            level: 'info',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 30,
        }),
        // Error log — แยกไฟล์สำหรับ error
        new winston.transports.File({
            filename: path.join(logDir, `error-${new Date().toISOString().slice(0,10)}.log`),
            level: 'error',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 30,
        }),
        // Auth failure log — แยกไฟล์สำหรับ auth fails (ใช้ดู pattern การโจมตี)
        new winston.transports.File({
            filename: path.join(logDir, `auth-failures-${new Date().toISOString().slice(0,10)}.log`),
            level: 'auth_failure',
            maxsize: 5 * 1024 * 1024,
            maxFiles: 30,
        }),
    ],
});

// Helper: log auth failure โดยเฉพาะ
logger.logAuthFailure = function (message, meta = {}) {
    this.log('auth_failure', message, meta);
};

module.exports = logger;
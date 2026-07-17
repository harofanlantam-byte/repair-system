// =============================================
// PM2 Ecosystem Configuration
// =============================================
// ติดตั้ง: npm install -g pm2
// เริ่ม:    pm2 start ecosystem.config.js
// สถานะ:   pm2 status
// log:     pm2 logs repair-system
// restart: pm2 restart repair-system
// stop:    pm2 stop repair-system
// startup: pm2 startup && pm2 save   (auto-start เมื่อ server reboot)
// =============================================

module.exports = {
  apps: [{
    name: 'repair-system',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
    },
    env_development: {
      NODE_ENV: 'development',
    },
    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Auto-restart ถ้าค้างหรือ crash
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    // Graceful shutdown
    kill_timeout: 10000,
    listen_timeout: 5000,
  }],
};
/**
 * Socket.IO Client Module
 * ใช้เชื่อมต่อ WebSocket Real-Time Notification กับ Server
 * โหลดไฟล์นี้ในทุกหน้า HTML ที่ต้องการรับการแจ้งเตือนแบบ Real-Time
 */

(function () {
  'use strict';

  // =============================================
  // SocketClient Class
  // =============================================
  class SocketClient {
    constructor() {
      this.socket = null;
      this.connected = false;
      this.listeners = {};
      this.eventQueue = [];
    }

    /**
     * เชื่อมต่อ Socket.IO Server
     * @returns {Promise}
     */
    connect() {
      return new Promise((resolve, reject) => {
        const token = localStorage.getItem('repair_token');
        if (!token) {
          console.warn('⚠️ [SocketClient] No token found, skipping WebSocket connection');
          resolve(false);
          return;
        }

        // เชื่อมต่อกับ server เดียวกัน
        const serverUrl = window.location.origin;

        this.socket = io(serverUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000
        });

        this.socket.on('connect', () => {
          console.log('✅ [SocketClient] Connected:', this.socket.id);
          this.connected = true;

          // Replay queued events
          while (this.eventQueue.length > 0) {
            const { event, data } = this.eventQueue.shift();
            this.socket.emit(event, data);
          }

          // Auto-subscribe to rooms based on role
          const user = this.getUser();
          if (user && user.role === 'admin') {
            this.socket.emit('subscribe', 'admin-room');
          }

          resolve(true);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('🔌 [SocketClient] Disconnected:', reason);
          this.connected = false;
        });

        this.socket.on('connect_error', (err) => {
          console.error('❌ [SocketClient] Connection error:', err.message);
          this.connected = false;
          reject(err);
        });

        // ลงทะเบียน event listeners หลัก
        this._setupCoreListeners();
      });
    }

    /**
     * ดึงข้อมูล user จาก localStorage
     */
    getUser() {
      try {
        const userStr = localStorage.getItem('repair_user');
        return userStr ? JSON.parse(userStr) : null;
      } catch {
        return null;
      }
    }

    /**
     * ตั้งค่า core event listeners
     */
    _setupCoreListeners() {
      if (!this.socket) return;

      // รับการแจ้งเตือนใหม่ (เฉพาะ admin)
      this.socket.on('new-notification', (data) => {
        console.log('🔔 [SocketClient] New notification:', data);
        this._trigger('new-notification', data);
        // Toast handled by initSocketIntegration() in script.js (with richer options)
        // เพิ่ม badge count
        this._incrementBadge();
      });

      // รับการอัปเดตคำแจ้งซ่อม (admin + user)
      this.socket.on('repair-updated', (data) => {
        console.log('🔧 [SocketClient] Repair updated:', data);

        // ตรวจสอบว่าเป็น completed หรือไม่
        if (data.type === 'repair-completed' || data.data?.completed) {
          this._trigger('repair-completed', data);
          // เล่นเสียงแจ้งเตือน (ถ้ามี)
          this._playNotificationSound();
        } else {
          this._trigger('repair-updated', data);
        }
        // Toast handled by initSocketIntegration() in script.js (with richer options)

        // เพิ่ม badge count
        this._incrementBadge();
      });

      // รับ error
      this.socket.on('error', (data) => {
        console.error('⚠️ [SocketClient] Server error:', data);
        this._trigger('error', data);
      });
    }

    /**
     * ลงทะเบียน event listener
     * @param {string} event - ชื่อ event
     * @param {function} callback - ฟังก์ชัน callback
     */
    on(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    }

    /**
     * ลบ event listener
     * @param {string} event - ชื่อ event
     * @param {function} callback - ฟังก์ชัน callback
     */
    off(event, callback) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    /**
     * Trigger event listeners
     */
    _trigger(event, data) {
      if (!this.listeners[event]) return;
      this.listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`❌ [SocketClient] Listener error for "${event}":`, e);
        }
      });
    }

    /**
     * ส่ง event ไป server
     * @param {string} event - ชื่อ event
     * @param {object} data - ข้อมูล
     */
    emit(event, data) {
      if (this.connected && this.socket) {
        this.socket.emit(event, data);
      } else {
        // Queue event ถ้ายังไม่เชื่อมต่อ
        this.eventQueue.push({ event, data });
        console.warn('⚠️ [SocketClient] Not connected, event queued:', event);
      }
    }

    /**
     * Emit: แจ้งว่ามีคำแจ้งซ่อมใหม่
     */
    emitNewRepair(repairData) {
      this.emit('new-repair', repairData);
    }

    /**
     * Emit: แจ้งว่าสถานะเปลี่ยน
     */
    emitStatusChange(statusData) {
      this.emit('status-change', statusData);
    }

    /**
     * Subscribe to room
     */
    subscribe(room) {
      if (this.connected && this.socket) {
        this.socket.emit('subscribe', room);
      }
    }

    /**
     * Unsubscribe from room
     */
    unsubscribe(room) {
      if (this.connected && this.socket) {
        this.socket.emit('unsubscribe', room);
      }
    }

    /**
     * ตัดการเชื่อมต่อ
     */
    disconnect() {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
        this.connected = false;
        this.listeners = {};
        this.eventQueue = [];
      }
    }

    /**
     * เช็คว่าเชื่อมต่ออยู่หรือไม่
     */
    isConnected() {
      return this.connected;
    }

    /**
     * เพิ่มจำนวน badge บน notification icon
     */
    _incrementBadge() {
      try {
        const badge = document.getElementById('noti-badge-count');
        if (badge) {
          let count = parseInt(badge.textContent) || 0;
          count++;
          badge.textContent = count > 99 ? '99+' : count;
          badge.style.display = 'flex';
        }
      } catch (e) {
        // ignore — badge element may not exist
      }
    }

    /**
     * เล่นเสียงแจ้งเตือนเมื่อซ่อมเสร็จ
     */
    _playNotificationSound() {
      try {
        // ใช้ Web Audio API สร้างเสียง notification แบบง่าย (ไม่ต้องใช้ไฟล์)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);

          oscillator.frequency.setValueAtTime(800, ctx.currentTime);
          oscillator.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.2);

          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
        }
      } catch (e) {
        // ignore — browser may block audio
      }
    }
  }

  // =============================================
  // สร้าง instance เดียว (Singleton)
  // =============================================
  if (!window.socketClient) {
    window.socketClient = new SocketClient();
  }

  // Auto-connect เมื่อ DOM โหลดเสร็จ
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await window.socketClient.connect();
    } catch (err) {
      console.warn('⚠️ [SocketClient] Auto-connect failed:', err.message);
    }
  });

})();
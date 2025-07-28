import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.eventHandlers = new Map();
  }

  connect(user) {
    if (this.socket) {
      this.disconnect();
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      this.isConnected = true;

      // Join appropriate rooms based on user role
      if (user) {
        if (user.isAdmin) {
          this.socket.emit('join-admin-room', user._id);
          console.log('👨‍💼 Joined admin room');
        } else {
          this.socket.emit('join-user-room', user._id);
          console.log('👤 Joined user room');
        }
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error);
      this.isConnected = false;
    });

    // Set up default event handlers
    this.setupDefaultHandlers();

    return this.socket;
  }

  setupDefaultHandlers() {
    // Message events
    this.socket.on('message-received', (data) => {
      console.log('📨 Message received:', data);
      this.emit('message-received', data);
    });

    this.socket.on('admin-submission-received', (data) => {
      console.log('📋 Admin submission received:', data);
      this.emit('admin-submission-received', data);
    });

    this.socket.on('admin-broadcast-received', (data) => {
      console.log('📢 Admin broadcast received:', data);
      this.emit('admin-broadcast-received', data);
    });

    // Payment events
    this.socket.on('payment-notification', (data) => {
      console.log('💳 Payment notification:', data);
      this.emit('payment-notification', data);
    });

    // Location events
    this.socket.on('location-update', (data) => {
      console.log('📍 Location update:', data);
      this.emit('location-update', data);
    });

    // Truck events
    this.socket.on('truck-location-updated', (data) => {
      console.log('🚚 Truck location updated:', data);
      this.emit('truck-location-updated', data);
    });

    this.socket.on('truck-dispatch-update', (data) => {
      console.log('🚛 Truck dispatch update:', data);
      this.emit('truck-dispatch-update', data);
    });

    // Pickup events
    this.socket.on('pickup-request-received', (data) => {
      console.log('📦 Pickup request received:', data);
      this.emit('pickup-request-received', data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('🔌 Socket disconnected manually');
    }
  }

  // Event emitter methods
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // Socket-specific emit methods
  sendMessage(data) {
    if (this.socket && this.isConnected) {
      this.socket.emit('new-message', data);
    }
  }

  sendAdminBroadcast(data) {
    if (this.socket && this.isConnected) {
      this.socket.emit('admin-broadcast', data);
    }
  }

  sendUserSubmission(data) {
    if (this.socket && this.isConnected) {
      this.socket.emit('user-submission', data);
    }
  }

  updateTruckLocation(data) {
    if (this.socket && this.isConnected) {
      this.socket.emit('truck-location-update', data);
    }
  }

  sendPaymentNotification(data) {
    if (this.socket && this.isConnected) {
      this.socket.emit('payment-received', data);
    }
  }

  shareLocation(data) {
    if (this.socket && this.isConnected) {
      this.socket.emit('location-shared', data);
    }
  }

  sendPickupRequest(data) {
    if (this.socket && this.isConnected) {
      this.socket.emit('new-pickup-request', data);
    }
  }

  dispatchTruck(data) {
    if (this.socket && this.isConnected) {
      this.socket.emit('truck-dispatched', data);
    }
  }

  // Utility methods
  isSocketConnected() {
    return this.isConnected && this.socket && this.socket.connected;
  }

  getSocketId() {
    return this.socket ? this.socket.id : null;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
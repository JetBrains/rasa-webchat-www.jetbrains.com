import io from 'socket.io-client';

export default function (socketUrl, customData, path, protocolOptions, onError) {
  const options = path ? { path } : {};

  // Pass customData in Socket.IO connection options so it's sent during handshake
  // Rasa expects token in customData.auth_header (via metadata_key: customData config)
  if (customData) {
    options.auth = customData;
    
    // Also pass token via extraHeaders for HTTP polling transport
    if (customData.auth_header) {
      options.extraHeaders = {
        Authorization: `Bearer ${customData.auth_header}`
      };
    }
  }

  // Add protocol options if provided (for token updates)
  if (protocolOptions) {
    Object.assign(options, protocolOptions);
    
    // Update Authorization header if token is provided in protocolOptions
    if (protocolOptions.token) {
      if (!options.extraHeaders) {
        options.extraHeaders = {};
      }
      options.extraHeaders.Authorization = `Bearer ${protocolOptions.token}`;
    }
  }

  console.log('Socket.IO: Creating connection to', socketUrl);
  console.log('Socket.IO: Token will be sent via auth options and extraHeaders');
  console.log('Socket.IO: customData:', customData);
  console.log('Socket.IO: options:', options);

  // CRITICAL: Close any existing managers for this URL to prevent duplicates
  if (typeof window !== 'undefined' && window.io && window.io.managers) {
    const managerKey = socketUrl;
    if (window.io.managers[managerKey]) {
      console.log('🧹 Closing existing manager for:', managerKey);
      try {
        window.io.managers[managerKey].close();
        delete window.io.managers[managerKey];
      } catch (e) {
        console.error('Error closing manager:', e);
      }
    }
  }

  const socket = io(socketUrl, options);

  // Add method to update auth headers for token refresh (Socket.IO v4 compatible)
  socket.updateAuthHeaders = function(newToken) {
    if (newToken && this.io) {
      console.log('🔧 Socket.IO v4: Updating auth headers with new token');
      console.log('🔧 NEW Authorization header:', `Bearer ${newToken.substring(0, 30)}...`);
      
      // Socket.IO v4: Update auth in manager
      if (this.auth) {
        this.auth.auth_header = newToken;
      }
      
      // Update extraHeaders in engine options (v4 structure)
      if (this.io.engine && this.io.engine.opts) {
        if (!this.io.engine.opts.extraHeaders) {
          this.io.engine.opts.extraHeaders = {};
        }
        this.io.engine.opts.extraHeaders.Authorization = `Bearer ${newToken}`;
      }
      
      // Also update in manager opts if available
      if (this.io.opts) {
        if (!this.io.opts.extraHeaders) {
          this.io.opts.extraHeaders = {};
        }
        this.io.opts.extraHeaders.Authorization = `Bearer ${newToken}`;
        
        if (!this.io.opts.auth) {
          this.io.opts.auth = {};
        }
        this.io.opts.auth.auth_header = newToken;
      }
      
      console.log('✅ Socket.IO v4: Auth headers updated successfully');
    }
  };

  // Log transport changes
  socket.io.on('reconnect_attempt', () => {
    console.log('Socket.IO: Reconnect attempt');
  });

  socket.io.on('reconnect', () => {
    console.log('Socket.IO: Reconnected successfully');
    
    // Check if we have updated customData and apply it
    if (socket.customData && socket.customData.auth_header) {
      console.log('Socket.IO: Applying updated customData after reconnection');
      socket.updateAuthHeaders(socket.customData.auth_header);
    }
  });

  socket.on('connect', () => {
    console.log(`Socket.IO: Connected with socket.id: ${socket.id}`);
    console.log(`Socket.IO: Transport: ${socket.io.engine.transport.name}`);
    socket.customData = customData;
    console.log('Socket.IO: customData set on socket');
  });

  // Log when transport upgrades
  socket.io.engine.on('upgrade', (transport) => {
    console.log(`Socket.IO: Transport upgraded to: ${transport.name}`);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.IO: Connection error:', error);
    console.error('Socket.IO: Error message:', error.message);
    if (error.type) {
      console.error('Socket.IO: Error type:', error.type);
    }
    onError();
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket.IO: Disconnected, reason:', reason);
  });

  // Log polling errors for debugging
  socket.io.engine.on('upgradeError', (error) => {
    console.error('Socket.IO: WebSocket upgrade failed:', error);
  });

  socket.io.engine.on('error', (error) => {
    console.error('Socket.IO: Engine error:', error);
  });

  return socket;
}
import io from 'socket.io-client';
import logger from '../utils/logger';
import { SocketConfigBuilder } from './SocketConfigBuilder';
import { SocketManagerCleaner } from './SocketManagerCleaner';
import { SocketAuthHeaderUpdater } from './SocketAuthHeaderUpdater';

export default function (socketUrl, customData, path, protocolOptions, onError) {
  // Build Socket.IO configuration
  const options = SocketConfigBuilder.build(customData, path, protocolOptions);

  logger.debug('Socket.IO: Creating connection to', socketUrl);

  // Clean up existing managers to prevent duplicates
  SocketManagerCleaner.cleanup(socketUrl);

  const socket = io(socketUrl, options);

  // Add method to update auth headers for token refresh
  SocketAuthHeaderUpdater.addUpdateMethod(socket);

  // Register event handlers
  // Log transport changes
  socket.io.on('reconnect_attempt', () => {
    logger.debug('Socket.IO: Reconnect attempt');
  });

  socket.io.on('reconnect', () => {
    logger.info('Socket.IO: Reconnected successfully');
    SocketAuthHeaderUpdater.updateOnReconnect(socket);
  });

  socket.on('connect', () => {
    logger.info(`Socket.IO: Connected with socket.id: ${socket.id}`);
    logger.debug(`Socket.IO: Transport: ${socket.io.engine.transport.name}`);
    socket.customData = customData;
    logger.debug('Socket.IO: customData set on socket');

    // Force-update headers on connect
    SocketAuthHeaderUpdater.updateOnConnect(socket, customData);
  });

  // Log when transport upgrades
  socket.io.engine.on('upgrade', (transport) => {
    logger.info(`Socket.IO: Transport upgraded to: ${transport.name}`);
  });

  socket.on('connect_error', (error) => {
    logger.error('Socket.IO: Connection error:', error);
    logger.error('Socket.IO: Error message:', error.message);
    if (error.type) {
      logger.error('Socket.IO: Error type:', error.type);
    }
    onError();
  });

  socket.on('disconnect', (reason) => {
    logger.info('Socket.IO: Disconnected, reason:', reason);
  });

  // Log polling errors for debugging
  socket.io.engine.on('upgradeError', (error) => {
    logger.error('Socket.IO: WebSocket upgrade failed:', error);
  });

  socket.io.engine.on('error', (error) => {
    logger.error('Socket.IO: Engine error:', error);
  });

  return socket;
}

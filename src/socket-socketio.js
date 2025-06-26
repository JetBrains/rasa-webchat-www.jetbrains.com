import io from 'socket.io-client';

export default function (socketUrl, customData, path, protocolOptions = {}) {
  const options = path ? { path } : {};

  if (protocolOptions.authToken) {
    options.extraHeaders = {
      Authorization: `Bearer ${protocolOptions.authToken}`
    };
    console.log('🔑 Authorization header added:', options.extraHeaders);
  }

  const socket = io(socketUrl, options);
  socket.on('connect', () => {
    console.log(`connect:${socket.id}`);
    socket.customData = { ...customData,
      metadata: {
        auth_header: protocolOptions.authToken
      } };
  });

  socket.on('connect_error', (error) => {
    console.log(error);
  });

  socket.on('disconnect', (reason) => {
    console.log(reason);
  });

  return socket;
}

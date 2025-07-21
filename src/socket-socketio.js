import io from 'socket.io-client';

export default function (socketUrl, customData, path, protocolOptions, onError) {
  const options = path ? { path } : {};

  if (protocolOptions.token) {
    options.extraHeaders = {
      Authorization: `Bearer ${protocolOptions.token}`
    };
  }

  const socket = io(socketUrl, options);
  socket.on('connect', () => {
    console.log(`connect:${socket.id}`);
    socket.customData = customData;
  });

  socket.on('connect_error', (error) => {
    console.log(error);
    onError();
  });

  socket.on('disconnect', (reason) => {
    console.log(reason);
  });

  return socket;
}

import socketio from './socket-socketio';
import sockjs from './socket-sockjs';

const PROTOCOLS = { socketio, sockjs };
// eslint-disable-next-line func-names
export default function (socketUrl, customData, path, protocol, protocolOptions, onError) {
  // eslint-disable-next-line no-param-reassign
  protocol = protocol || 'socketio';
  const socketProtocol = PROTOCOLS[protocol];

  if (socketProtocol !== undefined) {
    return socketProtocol(socketUrl, customData, path, protocolOptions, onError);
  }
  throw new Error(`Undefined socket protocol ${protocol}`);
}

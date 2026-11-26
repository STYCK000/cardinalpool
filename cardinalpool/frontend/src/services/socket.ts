import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

let socketInstance: Socket | null = null;

export function getTrackingSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      auth: { token: getAuthToken() },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socketInstance;
}

export function disconnectTrackingSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

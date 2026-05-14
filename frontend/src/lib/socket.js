import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(window.location.origin, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
};

export const disconnectSocket = () => {
  if (socket?.connected) socket.disconnect();
};

export const joinClassRoom = (classId) => {
  const s = getSocket();
  if (s.connected) s.emit('join_class', classId);
};

export const leaveClassRoom = (classId) => {
  const s = getSocket();
  if (s.connected) s.emit('leave_class', classId);
};

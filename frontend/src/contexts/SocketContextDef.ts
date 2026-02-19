import { createContext } from 'react';
import type { User, AllowedSubmissions, SocketQuizState } from '../types/types';
import type { Socket } from 'socket.io-client';

export interface SocketContextType {
  socket: Socket | null;
  quizState: SocketQuizState | null;
  user: User | null;
  userId: string | null;
  currentRoomId: string | null;
  isConnected: boolean;
  joinRoom: (roomId: string, userName: string) => void;
  leaveRoom: () => void;
  submitAnswer: (roomId: string, problemId: string, optionSelected: AllowedSubmissions) => void;
  createRoom: (userName: string) => void;
}

export const SocketContext = createContext<SocketContextType | undefined>(undefined);

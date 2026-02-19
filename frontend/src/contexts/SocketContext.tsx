import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { User, AllowedSubmissions, SocketQuizState } from '../types/types';
import { SocketContext } from './SocketContextDef';

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [quizState, setQuizState] = useState<SocketQuizState | null>(null);
  const [user] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    const newSocket = io(backendUrl);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for initial state when joining
    newSocket.on('init', (data) => {
      if (data.userId && data.state !== null) {
        setUserId(data.userId);
        setQuizState(data.state);
      } else {
        // Room doesn't exist or couldn't join
        setQuizState({ type: 'room_not_found' });
      }
    });

    // Listen for problem updates
    newSocket.on('problem', (data) => {
      setQuizState({
        type: 'question',
        problem: data.problem
      });
    });

    // Listen for leaderboard updates
    newSocket.on('leaderboard', (data) => {
      setQuizState({
        type: 'leaderboard',
        leaderboard: data.leaderboard
      });
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const joinRoom = (roomId: string, userName: string) => {
    if (socket) {
      socket.emit('join', { roomId, name: userName });
      setCurrentRoomId(roomId);
    }
  };

  const createRoom = (userName: string) => {
    // Generate a random room ID for the user
    const roomId = Math.random().toString(36).substring(2, 15);
    if (socket) {
      socket.emit('join', { roomId, name: userName });
      setCurrentRoomId(roomId);
    }
  };

  const leaveRoom = () => {
    if (socket && currentRoomId) {
      socket.emit('leave', { roomId: currentRoomId });
      setCurrentRoomId(null);
      setUserId(null);
      setQuizState(null);
    }
  };

  const submitAnswer = (roomId: string, problemId: string, optionSelected: AllowedSubmissions) => {
    if (socket && userId) {
      socket.emit('submit', {
        roomId,
        problemId,
        userId,
        submission: optionSelected,
      });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        quizState,
        user,
        userId,
        currentRoomId,
        isConnected,
        joinRoom,
        leaveRoom,
        submitAnswer,
        createRoom,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

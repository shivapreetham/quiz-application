import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { User, AllowedSubmissions, SocketQuizState } from '../types/types';
import { SocketContext } from './SocketContextDef';

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [quizState, setQuizState] = useState<SocketQuizState | null>(null);
  const [user] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(() => {
    // Persist userId in localStorage
    return localStorage.getItem('quizUserId');
  });
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(() => {
    // Persist roomId in localStorage
    return localStorage.getItem('quizRoomId');
  });
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    const newSocket = io(backendUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      setConnectionError(null);
      
      // Rejoin room if we were in one
      const savedRoomId = localStorage.getItem('quizRoomId');
      const savedUserName = localStorage.getItem('quizUserName');
      if (savedRoomId && savedUserName) {
        console.log('Rejoining room:', savedRoomId);
        newSocket.emit('join', { roomId: savedRoomId, name: savedUserName });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      setConnectionError('Connection lost. Attempting to reconnect...');
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionError('Failed to connect to server');
    });

    // Listen for initial state when joining
    newSocket.on('init', (data) => {
      console.log('Received init:', data);
      if (data.userId && data.state !== null) {
        setUserId(data.userId);
        localStorage.setItem('quizUserId', data.userId);
        setQuizState(data.state);
      } else {
        // Room doesn't exist or couldn't join
        setQuizState({ type: 'room_not_found' });
        // Clear saved data
        localStorage.removeItem('quizUserId');
        localStorage.removeItem('quizRoomId');
        localStorage.removeItem('quizUserName');
      }
    });

    // Listen for problem updates
    newSocket.on('problem', (data) => {
      console.log('Received problem:', data);
      setQuizState({
        type: 'question',
        problem: data.problem
      });
    });

    // Listen for leaderboard updates
    newSocket.on('leaderboard', (data) => {
      console.log('Received leaderboard:', data);
      setQuizState({
        type: 'leaderboard',
        leaderboard: data.leaderboard
      });
    });
    
    // Listen for quiz ended
    newSocket.on('quiz_ended', (data) => {
      console.log('Quiz ended:', data);
      setQuizState({
        type: 'ended',
        leaderboard: data.leaderboard
      });
    });
    
    // Listen for submission feedback
    newSocket.on('submissionSuccess', () => {
      console.log('Submission successful');
    });
    
    newSocket.on('submissionFailed', (data) => {
      console.error('Submission failed:', data.message);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const joinRoom = (roomId: string, userName: string) => {
    if (socket && roomId && userName) {
      console.log('Joining room:', roomId, 'as', userName);
      socket.emit('join', { roomId: roomId.trim(), name: userName.trim() });
      setCurrentRoomId(roomId);
      // Persist for reconnection
      localStorage.setItem('quizRoomId', roomId.trim());
      localStorage.setItem('quizUserName', userName.trim());
    }
  };

  const createRoom = (userName: string) => {
    // Generate a random room ID for the user
    const roomId = Math.random().toString(36).substring(2, 15);
    if (socket && userName) {
      console.log('Creating/joining room:', roomId);
      socket.emit('join', { roomId, name: userName.trim() });
      setCurrentRoomId(roomId);
      // Persist for reconnection
      localStorage.setItem('quizRoomId', roomId);
      localStorage.setItem('quizUserName', userName.trim());
    }
  };

  const leaveRoom = () => {
    if (socket && currentRoomId) {
      console.log('Leaving room:', currentRoomId);
      socket.emit('leave', { roomId: currentRoomId });
      setCurrentRoomId(null);
      setUserId(null);
      setQuizState(null);
      // Clear persisted data
      localStorage.removeItem('quizRoomId');
      localStorage.removeItem('quizUserId');
      localStorage.removeItem('quizUserName');
    }
  };

  const submitAnswer = (roomId: string, problemId: string, optionSelected: AllowedSubmissions) => {
    if (socket && userId && roomId && problemId != null) {
      console.log('Submitting answer:', { roomId, problemId, optionSelected, userId });
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
        connectionError,
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

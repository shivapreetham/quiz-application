import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  AllowedSubmissions,
  ProblemInput,
  Problem,
  QuizConfig,
  QuizSummary,
  SocketQuizState,
} from '../types/types';
import { SocketContext } from './SocketContextDef';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // User state
  const [quizState, setQuizState] = useState<SocketQuizState | null>(null);
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem('quiz_userId'));
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(() => localStorage.getItem('quiz_roomId'));

  // Admin state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [quizSummaries, setQuizSummaries] = useState<QuizSummary[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [currentQuizState, setCurrentQuizState] = useState<SocketQuizState | null>(null);
  const [currentQuizConfig, setCurrentQuizConfig] = useState<QuizConfig | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const selectedRoomIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(userId);

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { selectedRoomIdRef.current = selectedRoomId; }, [selectedRoomId]);

  // ── Socket lifecycle ──────────────────────────────────────────────────────

  useEffect(() => {
    const s = io(BACKEND_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      const savedRoom = localStorage.getItem('quiz_roomId');
      const savedName = localStorage.getItem('quiz_userName');
      if (savedRoom && savedName) s.emit('join', { roomId: savedRoom, name: savedName });
    });

    s.on('disconnect', () => {
      setIsConnected(false);
      setConnectionError('Connection lost. Reconnecting...');
    });

    s.on('connect_error', () => setConnectionError('Failed to connect to server'));

    // ── User events ──
    s.on('init', (data: { userId: string | null; state: SocketQuizState }) => {
      if (data.userId && data.state?.type !== 'room_not_found') {
        setUserId(data.userId);
        userIdRef.current = data.userId;
        localStorage.setItem('quiz_userId', data.userId);
        setQuizState(data.state);
      } else {
        setQuizState({ type: 'room_not_found' });
        clearUserStorage();
      }
    });

    s.on('stateUpdate', (state: SocketQuizState) => setQuizState(state));
    s.on('submissionSuccess', () => {});
    s.on('submissionFailed', (d: { message: string }) => console.warn('[submitAnswer] failed:', d.message));
    s.on('bulkSubmitSuccess', () => {});
    s.on('bulkSubmitFailed', (d: { message: string }) => console.warn('[bulkSubmit] failed:', d.message));

    // ── Admin events ──
    s.on('adminAuth', (data: { success: boolean }) => {
      setIsAuthenticated(data.success);
      if (data.success) s.emit('getAllQuizzes');
    });

    s.on('quizzesList', (data: { quizzes: QuizSummary[] }) => {
      setQuizSummaries(data.quizzes);
      // Update current quiz config if room is selected
      const selectedId = selectedRoomIdRef.current;
      if (selectedId) {
        const quiz = data.quizzes.find((q) => q.roomId === selectedId);
        if (quiz) {
          setCurrentQuizConfig(quiz.config);
        }
      }
    });
    s.on('quizCreated',   () => s.emit('getAllQuizzes'));
    s.on('quizStarted',   () => s.emit('getAllQuizzes'));
    s.on('quizScheduled', () => s.emit('getAllQuizzes'));

    const updateProblems = (data: { problems?: Problem[]; roomId?: string }) => {
      // Handle both { problems } and { roomId, problem, problems } formats
      if (data?.problems && Array.isArray(data.problems)) {
        // Only update if this is for the currently selected room
        if (!data.roomId || data.roomId === selectedRoomIdRef.current) {
          setProblems(data.problems);
        }
      }
    };
    s.on('problemAdded',      updateProblems);
    s.on('problemUpdated',    updateProblems);
    s.on('problemDeleted',    updateProblems);
    s.on('problemsReordered', updateProblems);
    s.on('problemsImported',  updateProblems);
    s.on('quizProblems',      updateProblems);

    s.on('quizStateUpdate', (state: SocketQuizState) => setCurrentQuizState(state));
    s.on('allSubmissionsForExport', (data: { submissions: any[]; problems: any[] }) => {
      // Store export data temporarily - components can access via callback
      (window as any).quizExportData = data;
    });
    s.on('error', (data: { event: string; message: string }) => {
      console.error('[server error]', data.event, data.message);
    });

    return () => { s.close(); };
  }, []);

  // ── User actions ──────────────────────────────────────────────────────────

  const joinRoom = useCallback((roomId: string, userName: string) => {
    socketRef.current?.emit('join', { roomId: roomId.trim(), name: userName.trim() });
    setCurrentRoomId(roomId);
    localStorage.setItem('quiz_roomId', roomId.trim());
    localStorage.setItem('quiz_userName', userName.trim());
  }, []);

  const leaveRoom = useCallback(() => {
    setCurrentRoomId(null);
    setUserId(null);
    setQuizState(null);
    clearUserStorage();
  }, []);

  /** per_question: submit an answer (or null to skip) */
  const submitAnswer = useCallback(
    (roomId: string, problemId: string, optionSelected: AllowedSubmissions | null) => {
      const uid = userIdRef.current;
      if (!uid) return;
      socketRef.current?.emit('submitAnswer', { roomId, problemId, userId: uid, optionSelected });
    },
    [],
  );

  /** total mode: finish quiz with all answers */
  const bulkSubmit = useCallback(
    (roomId: string, answers: { problemId: string; optionSelected: AllowedSubmissions; timeTaken?: number }[]) => {
      const uid = userIdRef.current;
      if (!uid) return;
      socketRef.current?.emit('bulkSubmit', { roomId, userId: uid, answers });
    },
    [],
  );

  // ── Admin actions ─────────────────────────────────────────────────────────

  const login = useCallback((password: string) => {
    socketRef.current?.emit('joinAdmin', { password });
  }, []);

  const selectRoom = useCallback((roomId: string) => {
    selectedRoomIdRef.current = roomId;
    setSelectedRoomId(roomId);
    setProblems([]);
    // Find the quiz config from summaries
    const quiz = quizSummaries.find((q) => q.roomId === roomId);
    if (quiz) {
      setCurrentQuizConfig(quiz.config);
    }
    socketRef.current?.emit('getQuizProblems', { roomId });
    socketRef.current?.emit('getQuizState', { roomId });
  }, [quizSummaries]);

  const createQuiz = useCallback((roomId: string, config: QuizConfig) => {
    socketRef.current?.emit('createQuiz', { roomId, config });
    // Store config immediately for the newly created quiz
    setCurrentQuizConfig(config);
  }, []);

  const addProblem = useCallback((problem: ProblemInput) => {
    const roomId = selectedRoomIdRef.current;
    if (!roomId) { console.error('[addProblem] no room selected'); return; }
    socketRef.current?.emit('addProblem', { roomId, problem });
  }, []);

  const updateProblem = useCallback((problemId: string, update: Partial<ProblemInput>) => {
    const roomId = selectedRoomIdRef.current;
    if (!roomId) return;
    socketRef.current?.emit('updateProblem', { roomId, problemId, problem: update });
  }, []);

  const deleteProblem = useCallback((problemId: string) => {
    const roomId = selectedRoomIdRef.current;
    if (!roomId) return;
    socketRef.current?.emit('deleteProblem', { roomId, problemId });
  }, []);

  const reorderProblems = useCallback((problemIds: string[]) => {
    const roomId = selectedRoomIdRef.current;
    if (!roomId) return;
    socketRef.current?.emit('reorderProblems', { roomId, problemIds });
  }, []);

  const importProblems = useCallback((probs: ProblemInput[]) => {
    const roomId = selectedRoomIdRef.current;
    if (!roomId) return;
    socketRef.current?.emit('importProblems', { roomId, problems: probs });
  }, []);

  const startQuiz = useCallback((roomId: string, joinWindowDuration?: number) => {
    socketRef.current?.emit('startQuiz', { roomId, joinWindowDuration });
  }, []);
  
  const getUserSubmissions = useCallback((roomId: string, userId: string) => {
    socketRef.current?.emit('getUserSubmissions', { roomId, userId });
  }, []);
  
  const getAllSubmissionsForExport = useCallback((roomId: string) => {
    socketRef.current?.emit('getAllSubmissionsForExport', { roomId });
  }, []);

  const scheduleQuiz = useCallback((roomId: string, startTime: number) => {
    socketRef.current?.emit('scheduleQuiz', { roomId, scheduledStartTime: startTime });
  }, []);

  const refreshQuizState = useCallback((roomId: string) => {
    socketRef.current?.emit('getQuizState', { roomId });
  }, []);

  function clearUserStorage() {
    localStorage.removeItem('quiz_userId');
    localStorage.removeItem('quiz_roomId');
    localStorage.removeItem('quiz_userName');
  }

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        connectionError,
        quizState,
        userId,
        currentRoomId,
        joinRoom,
        leaveRoom,
        submitAnswer,
        bulkSubmit,
        admin: {
          isAuthenticated,
          login,
          quizSummaries,
          selectedRoomId,
          selectRoom,
          createQuiz,
          problems,
          addProblem,
          updateProblem,
          deleteProblem,
          reorderProblems,
          importProblems,
          startQuiz,
          scheduleQuiz,
          currentQuizState,
          refreshQuizState,
          currentQuizConfig,
          getUserSubmissions,
          getAllSubmissionsForExport,
        },
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
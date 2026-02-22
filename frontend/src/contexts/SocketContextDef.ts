import { createContext } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  AllowedSubmissions,
  ProblemInput,
  QuizConfig,
  QuizSummary,
  SocketQuizState,
  Problem,
} from '../types/types';

export interface AdminContextType {
  isAuthenticated: boolean;
  login: (password: string) => void;

  quizSummaries: QuizSummary[];
  selectedRoomId: string | null;
  selectRoom: (roomId: string) => void;

  createQuiz: (roomId: string, config: QuizConfig) => void;

  problems: Problem[];
  addProblem: (problem: ProblemInput) => void;
  updateProblem: (problemId: string, update: Partial<ProblemInput>) => void;
  deleteProblem: (problemId: string) => void;
  reorderProblems: (problemIds: string[]) => void;
  importProblems: (problems: ProblemInput[]) => void;

  startQuiz: (roomId: string, joinWindowDuration?: number) => void;
  scheduleQuiz: (roomId: string, startTime: number) => void;

  currentQuizState: SocketQuizState | null;
  refreshQuizState: (roomId: string) => void;
  currentQuizConfig: QuizConfig | null;
  getUserSubmissions: (roomId: string, userId: string) => void;
  getAllSubmissionsForExport: (roomId: string) => void;
}

export interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;

  quizState: SocketQuizState | null;
  userId: string | null;
  currentRoomId: string | null;

  joinRoom: (roomId: string, userName: string) => void;
  leaveRoom: () => void;

  /** per_question mode: submit answer or skip (null = skip) */
  submitAnswer: (
    roomId: string,
    problemId: string,
    optionSelected: AllowedSubmissions | null,
  ) => void;

  /** total mode: finish quiz and submit all answers at once */
  bulkSubmit: (
    roomId: string,
    answers: { problemId: string; optionSelected: AllowedSubmissions }[],
  ) => void;

  admin: AdminContextType;
}

export const SocketContext = createContext<SocketContextType | undefined>(undefined);
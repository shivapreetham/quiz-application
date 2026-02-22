export type AllowedSubmissions = 0 | 1 | 2 | 3;
export type QuizDurationType = 'per_question' | 'total';
export type QuizStatus = 'not_started' | 'scheduled' | 'question' | 'ended';

export interface QuizConfig {
  durationType: QuizDurationType;
  durationPerQuestion?: number; // seconds, per_question mode
  totalDuration?: number;       // seconds, total mode
  scheduledStartTime?: number;
  /** Points configuration: 'same' means all questions have the same points, 'custom' means each question can have different points */
  pointsType?: 'same' | 'custom';
  /** Points per question when pointsType === 'same' */
  defaultPoints?: number;
}

export interface User {
  name: string;
  id: string;
  points: number;
  totalTimeTaken: number;
  correctAnswers: number;
  totalAnswered: number;
}

export interface Submission {
  problemId: string;
  userId: string;
  isCorrect: boolean;
  optionSelected: AllowedSubmissions;
  timeTaken: number;
  submittedAt: number;
}

export interface ProblemOption {
  id: number;
  title: string;
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  image?: string;
  startTime: number;
  answer: AllowedSubmissions;
  options: ProblemOption[];
  score: number;
  submissions: Submission[];
}

export interface ProblemInput {
  title: string;
  description: string;
  image?: string;
  options: ProblemOption[];
  answer: AllowedSubmissions;
  score: number;
}

export interface QuizSummary {
  roomId: string;
  status: QuizStatus;
  problemCount: number;
  userCount: number;
  config: QuizConfig;
  scheduledStartTime?: number;
}

// ── Socket state (server → client) ──────────────────────────────────────────

export type SocketQuizState =
  | { type: 'not_started' }
  | { type: 'scheduled'; scheduledStartTime: number }
  | {
      type: 'question';         // per_question mode
      problem: Problem;
      questionIndex: number;
      totalQuestions: number;
      config: QuizConfig;
      questionDeadline: number; // absolute epoch ms
      quizStartTime?: number;   // actual quiz start time
      joinWindowEndTime?: number | null; // when join window ends
    }
  | {
      type: 'free_attempt';     // total mode
      problems: Problem[];
      totalQuestions: number;
      config: QuizConfig;
      quizDeadline: number;     // absolute epoch ms
      quizStartTime?: number;   // actual quiz start time
      joinWindowEndTime?: number | null; // when join window ends
    }
  | { type: 'ended'; leaderboard: User[] }
  | { type: 'room_not_found' };

export type AdminStep = 'quiz-list' | 'create-quiz' | 'add-questions' | 'preview' | 'launch';
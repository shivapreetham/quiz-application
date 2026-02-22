export type AllowedSubmissions = 0 | 1 | 2 | 3;

/**
 * per_question: each question has its own timer; submit/skip/timeout locks it and moves forward
 * total:        one shared timer for the whole quiz; user navigates freely, submits at end
 */
export type QuizDurationType = 'per_question' | 'total';
export type QuizStatus = 'not_started' | 'scheduled' | 'question' | 'ended';

export interface QuizConfig {
  durationType: QuizDurationType;
  /** Seconds per question — required when durationType === 'per_question' */
  durationPerQuestion?: number;
  /** Total quiz duration in seconds — required when durationType === 'total' */
  totalDuration?: number;
  scheduledStartTime?: number;
  /** Points configuration: 'same' means all questions have the same points, 'custom' means each question can have different points */
  pointsType?: 'same' | 'custom';
  /** Points per question when pointsType === 'same' */
  defaultPoints?: number;
  /** Join window duration in seconds - users can join quiz within this time after start */
  joinWindowDuration?: number;
  /** Actual quiz start time (set when quiz begins) */
  actualStartTime?: number;
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

export interface ProblemInput {
  title: string;
  description: string;
  image?: string;
  options: ProblemOption[];
  answer: AllowedSubmissions;
  score: number;
}

export interface Problem extends ProblemInput {
  id: string;
  startTime: number;
  submissions: Submission[];
}

// ── What the server broadcasts to every client in the room ──────────────────

export type SocketQuizState =
  | { type: 'not_started' }
  | { type: 'scheduled'; scheduledStartTime: number }
  | {
      type: 'question';             // per_question mode: one question at a time
      problem: Problem;
      questionIndex: number;
      totalQuestions: number;
      config: QuizConfig;
      questionDeadline: number;     // absolute epoch ms when this question expires
      quizStartTime?: number;       // actual quiz start time
      joinWindowEndTime?: number | null; // when join window ends
    }
  | {
      type: 'free_attempt';         // total mode: all questions open simultaneously
      problems: Problem[];
      totalQuestions: number;
      config: QuizConfig;
      quizDeadline: number;         // absolute epoch ms when the whole quiz expires
      quizStartTime?: number;       // actual quiz start time
      joinWindowEndTime?: number | null; // when join window ends
    }
  | { type: 'ended'; leaderboard: User[] }
  | { type: 'room_not_found' };

// ── Admin socket payloads ────────────────────────────────────────────────────

export interface CreateQuizPayload    { roomId: string; config: QuizConfig; }
export interface AddProblemPayload    { roomId: string; problem: ProblemInput; }
export interface UpdateProblemPayload { roomId: string; problemId: string; problem: Partial<ProblemInput>; }
export interface DeleteProblemPayload { roomId: string; problemId: string; }
export interface ReorderProblemsPayload { roomId: string; problemIds: string[]; }
export interface ImportProblemsPayload  { roomId: string; problems: ProblemInput[]; }
export interface StartQuizPayload     { roomId: string; }
export interface ScheduleQuizPayload  { roomId: string; scheduledStartTime: number; }
export interface NextQuestionPayload  { roomId: string; }

// Bulk-submit payload for total-mode (user clicks Finish)
export interface BulkSubmitPayload {
  roomId: string;
  userId: string;
  answers: { problemId: string; optionSelected: AllowedSubmissions; timeTaken?: number }[];
}

export interface QuizSummary {
  roomId: string;
  status: QuizStatus;
  problemCount: number;
  userCount: number;
  config: QuizConfig;
  scheduledStartTime?: number;
}
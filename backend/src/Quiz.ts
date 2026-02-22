import { IoManager } from './managers/IoManager';
import {
  AllowedSubmissions,
  Problem,
  ProblemInput,
  QuizConfig,
  QuizStatus,
  SocketQuizState,
  Submission,
  User,
} from './types/types';

let globalProblemId = 0;

export class Quiz {
  public readonly roomId: string;
  private config: QuizConfig;
  private problems: Problem[];
  private users: User[];
  private status: QuizStatus;

  // per_question mode state
  private activeQuestionIndex: number = 0;
  private questionTimer: NodeJS.Timeout | null = null;

  // total mode state
  private quizDeadline: number | null = null;
  private quizEndTimer: NodeJS.Timeout | null = null;

  private scheduleTimer: NodeJS.Timeout | null = null;
  private joinWindowEndTime: number | null = null;

  // Track per-user join time so they get full question duration
  private userJoinTimes: Map<string, number> = new Map();

  constructor(roomId: string, config: QuizConfig) {
    this.roomId = roomId;
    this.config = config;
    this.problems = [];
    this.users = [];
    this.status = 'not_started';
  }

  // ─── Problem management ───────────────────────────────────────────────────

  addProblem(input: ProblemInput): Problem {
    this.assertEditable();
    const problem: Problem = {
      ...input,
      id: (globalProblemId++).toString(),
      startTime: 0,
      submissions: [],
    };
    this.problems.push(problem);
    return problem;
  }

  addProblems(inputs: ProblemInput[]): Problem[] {
    return inputs.map((p) => this.addProblem(p));
  }

  updateProblem(problemId: string, update: Partial<ProblemInput>): void {
    this.assertEditable();
    const idx = this.problems.findIndex((p) => p.id === problemId);
    if (idx === -1) throw new Error(`Problem ${problemId} not found`);
    this.problems[idx] = { ...this.problems[idx], ...update };
  }

  deleteProblem(problemId: string): void {
    this.assertEditable();
    this.problems = this.problems.filter((p) => p.id !== problemId);
  }

  reorderProblems(problemIds: string[]): void {
    this.assertEditable();
    if (problemIds.length !== this.problems.length) throw new Error('Problem ID count mismatch');
    this.problems = problemIds.map((id) => {
      const p = this.problems.find((x) => x.id === id);
      if (!p) throw new Error(`Problem ${id} not found`);
      return p;
    });
  }

  // ─── User management ─────────────────────────────────────────────────────

  addUser(name: string): string | null {
    const existingUser = this.users.find((u) => u.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (existingUser) {
      // Always allow rejoins (e.g. page refresh) — don't block existing users
      return existingUser.id;
    }

    // Block NEW users from joining after the join window has closed
    if (this.joinWindowEndTime !== null && Date.now() > this.joinWindowEndTime) {
      return null; // null signals "room not found / cannot join" to the client
    }

    // Also block new users if quiz is already running and there was never a join window
    if (this.status === 'question' && this.joinWindowEndTime === null) {
      return null;
    }

    const id = this.generateId(8);
    this.users.push({ id, name: name.trim(), points: 0, totalTimeTaken: 0, correctAnswers: 0, totalAnswered: 0 });
    
    if (this.status === 'question' && this.config.durationType === 'per_question') {
      this.userJoinTimes.set(id, Date.now());
    }
    
    return id;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  schedule(startTime: number): void {
    if (this.status !== 'not_started') throw new Error('Quiz already started or scheduled');
    if (startTime <= Date.now()) throw new Error('Scheduled time must be in the future');
    if (this.problems.length === 0) throw new Error('Cannot schedule quiz with no problems');
    this.status = 'scheduled';
    this.config.scheduledStartTime = startTime;
    this.scheduleTimer = setTimeout(() => { this.scheduleTimer = null; this.beginQuiz(); }, startTime - Date.now());
    this.broadcastCurrentState();
  }

  start(joinWindowDuration?: number): void {
    if (this.status === 'scheduled') {
      if (this.scheduleTimer) { clearTimeout(this.scheduleTimer); this.scheduleTimer = null; }
    } else if (this.status !== 'not_started') {
      throw new Error('Quiz already started');
    }
    if (this.problems.length === 0) throw new Error('Cannot start quiz with no problems');
    
    // Set join window if provided
    if (joinWindowDuration && joinWindowDuration > 0) {
      this.config.joinWindowDuration = joinWindowDuration;
      this.joinWindowEndTime = Date.now() + (joinWindowDuration * 1000);
    }
    
    this.beginQuiz();
  }

  private beginQuiz(): void {
    const now = Date.now();
    this.config.actualStartTime = now;

    if (this.config.durationType === 'per_question') {
      // Start first question
      this.activeQuestionIndex = 0;
      this.status = 'question';
      this.activateCurrentQuestion(now);
    } else {
      // total mode — open all questions at once
      this.quizDeadline = now + (this.config.totalDuration ?? 1800) * 1000;
      this.status = 'question'; // reuse 'question' status; state type differs
      this.problems.forEach((p) => { p.startTime = now; p.submissions = []; });
      this.broadcastCurrentState();
      // Hard deadline
      this.quizEndTimer = setTimeout(() => {
        this.quizEndTimer = null;
        this.endQuiz();
      }, this.config.totalDuration! * 1000);
    }
  }

  /** per_question only: move forward after submit / skip / timeout */
  advancePerQuestion(): void {
    if (this.config.durationType !== 'per_question') return;
    if (this.status !== 'question') return;

    this.clearQuestionTimer();
    const nextIdx = this.activeQuestionIndex + 1;
    if (nextIdx < this.problems.length) {
      this.activeQuestionIndex = nextIdx;
      // Clear per-user join times for the new question (everyone gets full time again on next Q)
      this.userJoinTimes.clear();
      this.activateCurrentQuestion(Date.now());
    } else {
      this.endQuiz();
    }
  }

  private activateCurrentQuestion(now: number): void {
    this.clearQuestionTimer();
    const problem = this.problems[this.activeQuestionIndex];
    problem.startTime = now;
    problem.submissions = [];
    this.broadcastCurrentState();

    const duration = this.config.durationPerQuestion ?? 30;
    this.questionTimer = setTimeout(() => {
      this.questionTimer = null;
      this.advancePerQuestion(); // auto-advance when time runs out
    }, duration * 1000);
  }

  // ─── Submission ───────────────────────────────────────────────────────────

  /**
   * per_question mode: submit answer for the current active question.
   * Records answer + advances to next question.
   * Pass optionSelected = null to skip (no answer recorded).
   */
  submitPerQuestion(userId: string, problemId: string, optionSelected: AllowedSubmissions | null): boolean {
    if (this.config.durationType !== 'per_question') return false;
    if (this.status !== 'question') return false;

    const problem = this.problems[this.activeQuestionIndex];
    if (!problem || problem.id !== problemId) return false;

    const user = this.users.find((u) => u.id === userId);
    if (!user) return false;

    // Prevent double submit for this question
    if (problem.submissions.some((s) => s.userId === userId)) return false;

    if (optionSelected !== null) {
      const now = Date.now();
      // Use per-user join time if available (so time is measured from when user joined, not question start)
      const userEffectiveStart = this.userJoinTimes.get(userId) ?? problem.startTime;
      const timeTaken = now - userEffectiveStart;
      const isCorrect = problem.answer === optionSelected;
      problem.submissions.push({ problemId, userId, isCorrect, optionSelected, timeTaken, submittedAt: now });
      user.totalAnswered++;
      user.totalTimeTaken += timeTaken;
      if (isCorrect) { user.correctAnswers++; user.points += problem.score; }
    }

    // Advance for this user — since all users share the same question stream,
    // advance the server question only once any user submits/skips
    // (server is single-stream: everyone moves together)
    this.advancePerQuestion();
    return true;
  }

  /**
   * total mode: user finishes the quiz and submits all answers at once.
   * answers includes problemId, optionSelected, and optionally timeTaken (time spent on each question).
   */
  bulkSubmit(userId: string, answers: { problemId: string; optionSelected: AllowedSubmissions; timeTaken?: number }[]): boolean {
    if (this.config.durationType !== 'total') return false;
    if (this.status !== 'question') return false;

    const user = this.users.find((u) => u.id === userId);
    if (!user) return false;

    // Prevent double finish
    if (this.problems.some((p) => p.submissions.some((s) => s.userId === userId))) return false;

    const now = Date.now();
    for (const { problemId, optionSelected, timeTaken: providedTimeTaken } of answers) {
      const problem = this.problems.find((p) => p.id === problemId);
      if (!problem) continue;
      
      // Use provided timeTaken if available (from client tracking), otherwise fallback to quiz start time
      const timeTaken = providedTimeTaken !== undefined 
        ? providedTimeTaken 
        : now - problem.startTime;
      
      const isCorrect = problem.answer === optionSelected;
      problem.submissions.push({ problemId, userId, isCorrect, optionSelected, timeTaken, submittedAt: now });
      user.totalAnswered++;
      user.totalTimeTaken += timeTaken;
      if (isCorrect) { user.correctAnswers++; user.points += problem.score; }
    }

    // End quiz when ALL users have submitted (or just end for everyone — design choice)
    // Here we end for everyone when ANY user finishes (simpler for classroom use)
    this.endQuiz();
    return true;
  }

  private endQuiz(): void {
    this.clearAllTimers();
    this.status = 'ended';
    this.broadcastCurrentState();
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  getStatus(): QuizStatus { return this.status; }
  getProblems(): Problem[] { return this.problems; }
  getConfig(): QuizConfig { return this.config; }

  getUserSubmissions(userId: string): Submission[] {
    return this.problems.flatMap((p) => p.submissions.filter((s) => s.userId === userId));
  }

  getAllSubmissionsForExport(): { user: User; submissions: Submission[] }[] {
    return this.users.map((user) => ({
      user,
      submissions: this.problems.flatMap((p) => p.submissions.filter((s) => s.userId === user.id)),
    }));
  }

  getLeaderboard(): User[] {
    return [...this.users].sort((a, b) =>
      b.points !== a.points ? b.points - a.points : a.totalTimeTaken - b.totalTimeTaken
    );
  }

  getSummary() {
    return {
      roomId: this.roomId,
      status: this.status,
      problemCount: this.problems.length,
      userCount: this.users.length,
      config: this.config,
      scheduledStartTime: this.config.scheduledStartTime,
    };
  }

  getCurrentState(): SocketQuizState {
    switch (this.status) {
      case 'not_started': return { type: 'not_started' };
      case 'scheduled':   return { type: 'scheduled', scheduledStartTime: this.config.scheduledStartTime! };
      case 'question': {
        if (this.config.durationType === 'per_question') {
          const problem = this.problems[this.activeQuestionIndex];
          const duration = this.config.durationPerQuestion ?? 30;
          const questionDeadline = problem.startTime + duration * 1000;
          return {
            type: 'question',
            problem,
            questionIndex: this.activeQuestionIndex,
            totalQuestions: this.problems.length,
            config: this.config,
            questionDeadline,
            quizStartTime: this.config.actualStartTime,
            joinWindowEndTime: this.joinWindowEndTime,
          };
        } else {
          // total mode
          return {
            type: 'free_attempt',
            problems: this.problems,
            totalQuestions: this.problems.length,
            config: this.config,
            quizDeadline: this.quizDeadline!,
            quizStartTime: this.config.actualStartTime,
            joinWindowEndTime: this.joinWindowEndTime,
          };
        }
      }
      case 'ended': return { type: 'ended', leaderboard: this.getLeaderboard() };
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private broadcastCurrentState(): void {
    IoManager.getIo().to(this.roomId).emit('stateUpdate', this.getCurrentState());
  }

  private clearQuestionTimer(): void {
    if (this.questionTimer) { clearTimeout(this.questionTimer); this.questionTimer = null; }
  }

  private clearAllTimers(): void {
    this.clearQuestionTimer();
    if (this.quizEndTimer) { clearTimeout(this.quizEndTimer); this.quizEndTimer = null; }
  }

  destroy(): void {
    this.clearAllTimers();
    if (this.scheduleTimer) { clearTimeout(this.scheduleTimer); this.scheduleTimer = null; }
  }

  private assertEditable(): void {
    if (this.status !== 'not_started' && this.status !== 'scheduled') {
      throw new Error('Cannot modify problems after quiz has started');
    }
  }

  private generateId(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}
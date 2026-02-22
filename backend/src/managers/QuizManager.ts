import { Quiz } from '../Quiz';
import {
  AllowedSubmissions,
  ProblemInput,
  QuizConfig,
  QuizSummary,
  SocketQuizState,
} from '../types/types';

export class QuizManager {
  private quizzes: Map<string, Quiz> = new Map();

  // ── Quiz CRUD ─────────────────────────────────────────────────────────────

  createQuiz(roomId: string, config: QuizConfig): void {
    const id = roomId.trim();
    if (!id) throw new Error('Room ID cannot be empty');
    if (this.quizzes.has(id)) throw new Error(`Room "${id}" already exists`);
    this.quizzes.set(id, new Quiz(id, config));
  }

  deleteQuiz(roomId: string): void {
    const quiz = this.getOrThrow(roomId);
    quiz.destroy();
    this.quizzes.delete(roomId);
  }

  // ── Problem management ────────────────────────────────────────────────────

  addProblem(roomId: string, problem: ProblemInput) {
    return this.getOrThrow(roomId).addProblem(problem);
  }

  addProblems(roomId: string, problems: ProblemInput[]) {
    return this.getOrThrow(roomId).addProblems(problems);
  }

  updateProblem(roomId: string, problemId: string, update: Partial<ProblemInput>): void {
    this.getOrThrow(roomId).updateProblem(problemId, update);
  }

  deleteProblem(roomId: string, problemId: string): void {
    this.getOrThrow(roomId).deleteProblem(problemId);
  }

  reorderProblems(roomId: string, problemIds: string[]): void {
    this.getOrThrow(roomId).reorderProblems(problemIds);
  }

  // ── User management ───────────────────────────────────────────────────────

  addUser(roomId: string, name: string): string | null {
    const quiz = this.quizzes.get(roomId);
    if (!quiz) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    return quiz.addUser(trimmed);
  }

  // ── Quiz lifecycle ────────────────────────────────────────────────────────

  start(roomId: string, joinWindowDuration?: number): void { 
    this.getOrThrow(roomId).start(joinWindowDuration); 
  }
  
  getUserSubmissions(roomId: string, userId: string) {
    return this.getOrThrow(roomId).getUserSubmissions(userId);
  }
  
  getAllSubmissionsForExport(roomId: string) {
    return this.getOrThrow(roomId).getAllSubmissionsForExport();
  }
  schedule(roomId: string, startTime: number): void { this.getOrThrow(roomId).schedule(startTime); }

  // ── Submissions ───────────────────────────────────────────────────────────

  /** per_question mode: submit or skip one question */
  submitPerQuestion(
    userId: string,
    roomId: string,
    problemId: string,
    optionSelected: AllowedSubmissions | null,
  ): boolean {
    const quiz = this.quizzes.get(roomId);
    return quiz ? quiz.submitPerQuestion(userId, problemId, optionSelected) : false;
  }

  /** total mode: finish quiz and submit all answers */
  bulkSubmit(
    userId: string,
    roomId: string,
    answers: { problemId: string; optionSelected: AllowedSubmissions }[],
  ): boolean {
    const quiz = this.quizzes.get(roomId);
    return quiz ? quiz.bulkSubmit(userId, answers) : false;
  }

  // ── State queries ─────────────────────────────────────────────────────────

  getCurrentState(roomId: string): SocketQuizState | null {
    return this.quizzes.get(roomId)?.getCurrentState() ?? null;
  }

  getAllQuizSummaries(): QuizSummary[] {
    return Array.from(this.quizzes.values()).map((q) => q.getSummary());
  }

  getQuizProblems(roomId: string) {
    return this.getOrThrow(roomId).getProblems();
  }
  
  getQuizProblemsForExport(roomId: string) {
    return this.getOrThrow(roomId).getProblems();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getOrThrow(roomId: string): Quiz {
    const quiz = this.quizzes.get(roomId);
    if (!quiz) throw new Error(`Room "${roomId}" not found`);
    return quiz;
  }
}
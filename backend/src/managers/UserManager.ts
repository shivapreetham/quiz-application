import { Socket } from 'socket.io';
import { QuizManager } from './QuizManager';
import {
  AllowedSubmissions,
  AddProblemPayload,
  CreateQuizPayload,
  DeleteProblemPayload,
  ImportProblemsPayload,
  NextQuestionPayload,
  ReorderProblemsPayload,
  ScheduleQuizPayload,
  StartQuizPayload,
  UpdateProblemPayload,
  BulkSubmitPayload,
} from '../types/types';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ADMIN_PASSWORD';

export class UserManager {
  private quizManager: QuizManager;

  constructor() {
    this.quizManager = new QuizManager();
  }

  addUser(socket: Socket): void {
    this.registerUserHandlers(socket);
    this.registerAdminAuthHandler(socket);
  }

  // ─── User handlers ────────────────────────────────────────────────────────

  private registerUserHandlers(socket: Socket): void {
    socket.on('join', (data: { roomId: string; name: string }) => {
      try {
        if (!data?.roomId?.trim() || !data?.name?.trim()) {
          socket.emit('init', { userId: null, state: { type: 'room_not_found' } });
          return;
        }
        const userId = this.quizManager.addUser(data.roomId, data.name);
        if (!userId) {
          socket.emit('init', { userId: null, state: { type: 'room_not_found' } });
          return;
        }
        // If user already exists, they're rejoining - update their socket association
        // The userId returned is the existing user's ID
        const state = this.quizManager.getCurrentState(data.roomId);
        socket.emit('init', { userId, state: state ?? { type: 'room_not_found' } });
        socket.join(data.roomId);
        console.log(`[join] ${data.name} (${userId}) → room ${data.roomId}`);
      } catch (err) {
        console.error('[join] error:', err);
        socket.emit('init', { userId: null, state: { type: 'room_not_found' } });
      }
    });

    /**
     * per_question mode: submit an answer (optionSelected) or skip (optionSelected = null).
     * Server records the answer and advances the question for everyone.
     */
    socket.on(
      'submitAnswer',
      (data: { roomId: string; problemId: string; userId: string; optionSelected: AllowedSubmissions | null }) => {
        try {
          const { roomId, problemId, userId, optionSelected } = data;
          if (!roomId || !problemId || !userId) return;
          if (optionSelected !== null && ![0, 1, 2, 3].includes(optionSelected)) return;

          const success = this.quizManager.submitPerQuestion(userId, roomId, problemId, optionSelected);
          if (success) {
            socket.emit('submissionSuccess', { problemId });
          } else {
            socket.emit('submissionFailed', { message: 'Submission failed or already submitted' });
          }
        } catch (err) {
          console.error('[submitAnswer] error:', err);
          socket.emit('submissionFailed', { message: 'Submission error' });
        }
      },
    );

    /**
     * total mode: user clicks Finish — bulk-submit all answers at once.
     */
    socket.on('bulkSubmit', (data: BulkSubmitPayload) => {
      try {
        const { roomId, userId, answers } = data;
        if (!roomId || !userId || !Array.isArray(answers)) return;

        const success = this.quizManager.bulkSubmit(userId, roomId, answers);
        if (success) {
          socket.emit('bulkSubmitSuccess');
        } else {
          socket.emit('bulkSubmitFailed', { message: 'Bulk submit failed or already submitted' });
        }
      } catch (err) {
        console.error('[bulkSubmit] error:', err);
        socket.emit('bulkSubmitFailed', { message: 'Submit error' });
      }
    });
  }

  // ─── Admin auth + handlers ────────────────────────────────────────────────

  private registerAdminAuthHandler(socket: Socket): void {
    socket.on('joinAdmin', (data: { password: string }) => {
      if (data?.password !== ADMIN_PASSWORD) {
        socket.emit('adminAuth', { success: false });
        return;
      }
      socket.emit('adminAuth', { success: true });
      this.registerAdminHandlers(socket);
    });
  }

  private registerAdminHandlers(socket: Socket): void {
    // ── Quiz lifecycle ──

    socket.on('createQuiz', (data: CreateQuizPayload) => {
      this.handle(socket, 'createQuiz', () => {
        this.quizManager.createQuiz(data.roomId, data.config);
        socket.emit('quizCreated', { roomId: data.roomId });
        socket.emit('quizzesList', { quizzes: this.quizManager.getAllQuizSummaries() });
      });
    });

    socket.on('startQuiz', (data: StartQuizPayload) => {
      this.handle(socket, 'startQuiz', () => {
        this.quizManager.start(data.roomId, data.joinWindowDuration);
        socket.emit('quizStarted', { roomId: data.roomId });
        socket.emit('quizzesList', { quizzes: this.quizManager.getAllQuizSummaries() });
      });
    });
    
    socket.on('getUserSubmissions', (data: { roomId: string; userId: string }) => {
      this.handle(socket, 'getUserSubmissions', () => {
        const submissions = this.quizManager.getUserSubmissions(data.roomId, data.userId);
        socket.emit('userSubmissions', { roomId: data.roomId, userId: data.userId, submissions });
      });
    });

    socket.on('scheduleQuiz', (data: ScheduleQuizPayload) => {
      this.handle(socket, 'scheduleQuiz', () => {
        this.quizManager.schedule(data.roomId, data.scheduledStartTime);
        socket.emit('quizScheduled', { roomId: data.roomId, scheduledStartTime: data.scheduledStartTime });
      });
    });

    // ── Problem management ──

    socket.on('addProblem', (data: AddProblemPayload) => {
      this.handle(socket, 'addProblem', () => {
        const problem = this.quizManager.addProblem(data.roomId, data.problem);
        const problems = this.quizManager.getQuizProblems(data.roomId);
        socket.emit('problemAdded', { roomId: data.roomId, problem, problems });
      });
    });

    socket.on('updateProblem', (data: UpdateProblemPayload) => {
      this.handle(socket, 'updateProblem', () => {
        this.quizManager.updateProblem(data.roomId, data.problemId, data.problem);
        const problems = this.quizManager.getQuizProblems(data.roomId);
        socket.emit('problemUpdated', { roomId: data.roomId, problems });
      });
    });

    socket.on('deleteProblem', (data: DeleteProblemPayload) => {
      this.handle(socket, 'deleteProblem', () => {
        this.quizManager.deleteProblem(data.roomId, data.problemId);
        const problems = this.quizManager.getQuizProblems(data.roomId);
        socket.emit('problemDeleted', { roomId: data.roomId, problems });
      });
    });

    socket.on('reorderProblems', (data: ReorderProblemsPayload) => {
      this.handle(socket, 'reorderProblems', () => {
        this.quizManager.reorderProblems(data.roomId, data.problemIds);
        const problems = this.quizManager.getQuizProblems(data.roomId);
        socket.emit('problemsReordered', { roomId: data.roomId, problems });
      });
    });

    socket.on('importProblems', (data: ImportProblemsPayload) => {
      this.handle(socket, 'importProblems', () => {
        const added = this.quizManager.addProblems(data.roomId, data.problems);
        const problems = this.quizManager.getQuizProblems(data.roomId);
        socket.emit('problemsImported', { roomId: data.roomId, count: added.length, problems });
      });
    });

    // ── State queries ──

    socket.on('getAllQuizzes', () => {
      this.handle(socket, 'getAllQuizzes', () => {
        socket.emit('quizzesList', { quizzes: this.quizManager.getAllQuizSummaries() });
      });
    });

    socket.on('getQuizState', (data: { roomId: string }) => {
      this.handle(socket, 'getQuizState', () => {
        const state = this.quizManager.getCurrentState(data.roomId);
        socket.emit('quizStateUpdate', state ?? { type: 'room_not_found' });
      });
    });

    socket.on('getQuizProblems', (data: { roomId: string }) => {
      this.handle(socket, 'getQuizProblems', () => {
        const problems = this.quizManager.getQuizProblems(data.roomId);
        socket.emit('quizProblems', { roomId: data.roomId, problems });
      });
    });
    
    socket.on('getUserSubmissions', (data: { roomId: string; userId: string }) => {
      this.handle(socket, 'getUserSubmissions', () => {
        const submissions = this.quizManager.getUserSubmissions(data.roomId, data.userId);
        socket.emit('userSubmissions', { roomId: data.roomId, userId: data.userId, submissions });
      });
    });
    
    socket.on('getAllSubmissionsForExport', (data: { roomId: string }) => {
      this.handle(socket, 'getAllSubmissionsForExport', () => {
        const submissions = this.quizManager.getAllSubmissionsForExport(data.roomId);
        const problems = this.quizManager.getQuizProblems(data.roomId);
        socket.emit('allSubmissionsForExport', { roomId: data.roomId, submissions, problems });
      });
    });
  }

  // ─── Generic error wrapper ────────────────────────────────────────────────

  private handle(socket: Socket, event: string, fn: () => void): void {
    try {
      fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Error in ${event}`;
      console.error(`[${event}] error:`, message);
      socket.emit('error', { event, message });
    }
  }
}
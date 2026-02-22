import { Quiz } from "../Quiz";
import { AllowedSubmissions } from "../types/types";
import { IoManager } from "./IoManager";
let globalProblemId = 0;

export class QuizManager {

    private quizes: Quiz[];

    
    constructor() {
        this.quizes = [];
    }

    public start(roomId: string) {
        const quiz = this.getQuiz(roomId);
        if (!quiz) {
            throw new Error(`Quiz room "${roomId}" not found`);
        }
        quiz.start();
    }

    public addProblem(roomId: string, problem: {
        title: string;
        description: string;
        image?: string;
        options: {
            id: number;
            title: string;
        }[];
        answer: AllowedSubmissions;
    }) {
        const quiz = this.getQuiz(roomId);
        if (!quiz) {
            throw new Error(`Quiz room "${roomId}" not found`);
        }
        
        if (!problem.title || !problem.description) {
            throw new Error("Problem must have title and description");
        }
        
        if (!problem.options || problem.options.length < 2) {
            throw new Error("Problem must have at least 2 options");
        }
        
        quiz.addProblem({
            ...problem,
            id: (globalProblemId++).toString(),
            startTime: new Date().getTime(),
            submissions: []
        });
    }

    public addProblems(roomId: string, problems: {
        title: string;
        description: string;
        image?: string;
        options: {
            id: number;
            title: string;
        }[];
        answer: AllowedSubmissions;
    }[]) {
        const quiz = this.getQuiz(roomId);
        if (!quiz) {
            throw new Error(`Quiz room "${roomId}" not found`);
        }
        
        if (!problems || problems.length === 0) {
            throw new Error("No problems provided");
        }
        
        // Validate all problems before adding any
        problems.forEach((problem, index) => {
            if (!problem.title || !problem.description) {
                throw new Error(`Problem ${index + 1}: Missing title or description`);
            }
            if (!problem.options || problem.options.length < 2) {
                throw new Error(`Problem ${index + 1}: Must have at least 2 options`);
            }
        });
        
        problems.forEach(problem => {
            quiz.addProblem({
                ...problem,
                id: (globalProblemId++).toString(),
                startTime: new Date().getTime(),
                submissions: []
            });
        });
        
        return problems.length;
    }

    public next(roomId: string) {
        const quiz = this.getQuiz(roomId);
        if (!quiz) {
            throw new Error(`Quiz room "${roomId}" not found`);
        }
        quiz.next();
    }

    addUser(roomId: string, name: string) {
        const quiz = this.getQuiz(roomId);
        if (!quiz) {
            return null;
        }
        if (!name || name.trim().length === 0) {
            return null;
        }
        return quiz.addUser(name.trim());
    }

    submit(userId: string, roomId: string, problemId: string, submission: 0 | 1 | 2 | 3) {
        const quiz = this.getQuiz(roomId);
        if (!quiz) {
            return false;
        }
        return quiz.submit(userId, roomId, problemId, submission);
    }

    getQuiz(roomId: string) {
        return this.quizes.find(x => x.roomId === roomId) ?? null;
    }

    getCurrentState(roomId: string) {
        const quiz = this.quizes.find(x => x.roomId === roomId);
        if (!quiz) {
            return null;
        }
        return quiz.getCurrentState();
    }

    addQuiz(roomId: string) {
        if (!roomId || roomId.trim().length === 0) {
            throw new Error("Room ID cannot be empty");
        }
        
        if (this.getQuiz(roomId)) {
            throw new Error(`Quiz room "${roomId}" already exists`);
        }
        const quiz = new Quiz(roomId);
        this.quizes.push(quiz);
    }
    
    getAllQuizzes() {
        return this.quizes.map(q => ({
            roomId: q.roomId
        }));
    }
}
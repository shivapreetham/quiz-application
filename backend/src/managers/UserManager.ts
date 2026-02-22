import { Socket } from "socket.io";
import { QuizManager } from "./QuizManager";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ADMIN_PASSWORD";

export class UserManager {

    // This class manages user interactions with the quiz system.
    // It handles user connections, quiz creation, problem submission, and state management.
    private quizManager;

    /* 
    This constructor initializes the UserManager with a QuizManager instance.
    */
    constructor() {
        this.quizManager = new QuizManager
    }

    addUser(socket: Socket) {
        this.createHandlers(socket);
    }

    private createHandlers(socket: Socket) {
        socket.on("join", (data) => {
            try {
                if (!data.roomId || !data.name) {
                    socket.emit("init", {
                        userId: null,
                        state: { type: "room_not_found" }
                    });
                    return;
                }
                
                const userId = this.quizManager.addUser(data.roomId, data.name);
                
                if (!userId) {
                    socket.emit("init", {
                        userId: null,
                        state: { type: "room_not_found" }
                    });
                    return;
                }
                
                const state = this.quizManager.getCurrentState(data.roomId);
                socket.emit("init", {
                    userId,
                    state: state || { type: "room_not_found" }
                });
                socket.join(data.roomId);
                console.log(`User ${data.name} (${userId}) joined room ${data.roomId}`);
            } catch (error) {
                console.error("Error joining room:", error);
                socket.emit("init", {
                    userId: null,
                    state: { type: "room_not_found" }
                });
            }
        });

        socket.on("joinAdmin", (data) => {
            console.log("Admin login attempt with password:", data.password);
            if (data.password !== ADMIN_PASSWORD) {
                console.log("Admin authentication failed");
                socket.emit("adminAuth", { success: false });
                return;
            }
            console.log("Admin authenticated successfully");
            socket.emit("adminAuth", { success: true });

            socket.on("createQuiz", data => {
                try {
                    this.quizManager.addQuiz(data.roomId);
                    socket.emit("quizCreated", { roomId: data.roomId });
                    console.log(`Quiz room created: ${data.roomId}`);
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to create quiz";
                    console.error("Create quiz error:", message);
                    socket.emit("error", { message });
                }
            });

            socket.on("createProblem", data => {
                try {
                    this.quizManager.addProblem(data.roomId, data.problem);
                    socket.emit("problemAdded", { roomId: data.roomId });
                    console.log(`Problem added to room ${data.roomId}`);
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to add problem";
                    console.error("Add problem error:", message);
                    socket.emit("error", { message });
                }
            });

            socket.on("importProblems", data => {
                try {
                    const count = this.quizManager.addProblems(data.roomId, data.problems);
                    socket.emit("problemsImported", { roomId: data.roomId, count });
                    console.log(`${count} problems imported to room ${data.roomId}`);
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to import problems";
                    console.error("Import problems error:", message);
                    socket.emit("error", { message });
                }
            });

            socket.on("next", data => {
                try {
                    this.quizManager.next(data.roomId);
                    console.log(`Moving to next question in room ${data.roomId}`);
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to proceed to next question";
                    console.error("Next question error:", message);
                    socket.emit("error", { message });
                }
            });

            socket.on("start", data => {
                try {
                    this.quizManager.start(data.roomId);
                    console.log(`Quiz started in room ${data.roomId}`);
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to start quiz";
                    console.error("Start quiz error:", message);
                    socket.emit("error", { message });
                }
            });

            socket.on("getQuizState", data => {
                try {
                    const state = this.quizManager.getCurrentState(data.roomId);
                    socket.emit("quizStateUpdate", state);
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to get quiz state";
                    console.error("Get quiz state error:", message);
                    socket.emit("error", { message });
                }
            });
            
            socket.on("getAllQuizzes", () => {
                try {
                    const quizzes = this.quizManager.getAllQuizzes();
                    socket.emit("quizzesList", { quizzes });
                } catch (error) {
                    console.error("Get all quizzes error:", error);
                    socket.emit("error", { message: "Failed to get quizzes list" });
                }
            });
        });

        socket.on("submit", (data) => {
            try {
                const userId = data.userId;
                const problemId = data.problemId;
                const submission = data.submission;
                const roomId = data.roomId;
                
                if (!userId || !problemId || !roomId) {
                    console.error("Missing required submission data");
                    return;
                }
                
                if (submission !== 0 && submission !== 1 && submission !== 2 && submission !== 3) {
                    console.error("Invalid submission value: " + submission);
                    return;
                }
                
                console.log(`User ${userId} submitting answer for problem ${problemId} in room ${roomId}`);
                const success = this.quizManager.submit(userId, roomId, problemId, submission);
                
                if (success) {
                    socket.emit("submissionSuccess", { problemId });
                } else {
                    socket.emit("submissionFailed", { message: "Submission failed" });
                }
            } catch (error) {
                console.error("Submission error:", error);
                socket.emit("submissionFailed", { message: "Submission failed" });
            }
        });
    }


}
import { IoManager } from "./managers/IoManager";
import { AllowedSubmissions, Problem, User } from "./types/types";

const PROBLEM_TIME_S = 20;


export class Quiz {

    public roomId: string;
    private hasStarted: boolean;
    private problems: Problem[];
    private activeProblem: number;
    private users: User[];
    private currentState: "leaderboard" | "question" | "not_started" | "ended";
    private leaderboardTimer: NodeJS.Timeout | null = null;
    private hasEnded: boolean = false;


    /* 
    Constructor for the Quiz class.
    Initializes the quiz with a room ID, sets the quiz state to not started,
    initializes the problems array, sets the active problem index to 0,
    initializes the users array, and sets the current state to "not_started".

    @param {string} roomId - The unique identifier for the quiz room.
    @returns {void}
    
    */
    constructor(roomId: string) {
        this.roomId = roomId;
        this.hasStarted = false;
        this.problems = []
        this.activeProblem = 0;
        this.users = [];
        this.currentState = "not_started";
        console.log("room created");
        setInterval(() => {
            this.debug();
        }, 10000)
    }

    /*
    Debug method to log the current state of the quiz.
    It logs the room ID, problems, users, current state, and active problem index to the console.

    @returns {void}
    */

    debug() {
        console.log("----debug---")
        console.log(this.roomId)
        console.log(JSON.stringify(this.problems))
        console.log(this.users)
        console.log(this.currentState)
        console.log(this.activeProblem);
    }

    /*
    Adds a problem to the quiz.

    @param {Problem} problem - The problem to add.

    @returns {void}
    */

    addProblem(problem: Problem) {
        this.problems.push(problem);
        console.log(this.problems);
    }

    /*
    Starts the quiz by setting the hasStarted flag to true and setting the first problem as the active problem.
    It emits the "problem" event to the room with the first problem.

    @returns {void}
    */

    start() {
        if (this.hasStarted) {
            console.log("Quiz already started");
            return;
        }
        if (this.problems.length === 0) {
            throw new Error("Cannot start quiz: No problems added");
        }
        if (this.hasEnded) {
            throw new Error("Cannot start quiz: Quiz has ended");
        }
        this.hasStarted = true;
        this.setActiveProblem(this.problems[0]);
    }

    /*
    Sets the active problem for the quiz.

    @param {Problem} problem - The problem to set as active.
    @returns {void}
    */

    setActiveProblem(problem: Problem) {
        console.log("set active problem")
        // Clear any existing timer to prevent race conditions
        if (this.leaderboardTimer) {
            clearTimeout(this.leaderboardTimer);
            this.leaderboardTimer = null;
        }
        
        this.currentState = "question"
        problem.startTime = new Date().getTime();
        problem.submissions = [];
        IoManager.getIo().to(this.roomId).emit("problem", {
            problem
        })
        
        // Set new timer for leaderboard
        this.leaderboardTimer = setTimeout(() => {
            this.sendLeaderboard();
            this.leaderboardTimer = null;
        }, PROBLEM_TIME_S * 1000);
    }

    /*

    Sends the leaderboard to the room and updates the current state to "leaderboard".
    @returns {void}

    */


    sendLeaderboard() {
        console.log("send leaderboard")
        this.currentState = "leaderboard"
        const leaderboard = this.getLeaderboard();
        IoManager.getIo().to(this.roomId).emit("leaderboard", {
            leaderboard
        })
    }

    /*
    Moves to the next problem in the quiz.

    @returns {void}
    */

    next() {
        if (!this.hasStarted) {
            throw new Error("Cannot move to next: Quiz not started");
        }
        if (this.hasEnded) {
            console.log("Quiz has already ended");
            return;
        }
        
        // Clear the current timer before moving to next
        if (this.leaderboardTimer) {
            clearTimeout(this.leaderboardTimer);
            this.leaderboardTimer = null;
        }
        
        this.activeProblem++;
        const problem = this.problems[this.activeProblem];
        if (problem) {
            this.setActiveProblem(problem);
        } else {
            this.activeProblem--;
            this.endQuiz();
        }
    }

    /*
    Ends the quiz and sends final results.

    @returns {void}
    */
    endQuiz() {
        if (this.hasEnded) {
            return;
        }
        
        console.log("Ending quiz");
        this.hasEnded = true;
        this.currentState = "ended";
        
        // Clear any pending timers
        if (this.leaderboardTimer) {
            clearTimeout(this.leaderboardTimer);
            this.leaderboardTimer = null;
        }
        
        const leaderboard = this.getLeaderboard();
        IoManager.getIo().to(this.roomId).emit("quiz_ended", {
            leaderboard
        });
    }

    /*
    Generates a random string of a specified length.

    @param {number} length - The length of the random string to generate.
    @returns {string} - The generated random string.
    */

    genRandonString(length: number) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()';
        var charLength = chars.length;
        var result = '';
        for (var i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * charLength));
        }
        return result;
    }

    /*
    Adds a user to the quiz.

    @param {string} name - The name of the user to add.
    @returns {string} - The ID of the added user.
    */

    addUser(name: string) {
        const id = this.genRandonString(7);
        this.users.push({
            id,
            name,
            points: 0
        })
        return id;
    }

    /*
    Submits a user's answer to a problem in the quiz.
    @param {string} userId - The ID of the user submitting the answer.
    @param {string} roomId - The ID of the room where the quiz is taking place.
    @param {string} problemId - The ID of the problem being answered.
    @param {AllowedSubmissions} submission - The user's submission.

    @returns {void}
    */

    submit(userId: string, roomId: string, problemId: string, submission: AllowedSubmissions) {
        console.log("userId");
        console.log(userId);
        
        if (!this.hasStarted) {
            console.log("Cannot submit: Quiz not started");
            return false;
        }
        
        if (this.hasEnded) {
            console.log("Cannot submit: Quiz has ended");
            return false;
        }
        
        const problem = this.problems.find(x => x.id == problemId);
        const user = this.users.find(x => x.id === userId);

        if (!problem || !user) {
            console.log("problem or user not found")
            return false;
        }
        
        const existingSubmission = problem.submissions.find(x => x.userId === userId);

        if (existingSubmission) {
            console.log("existing submission found")
            return false;
        }
        
        const isCorrect = problem.answer === submission;

        problem.submissions.push({
            problemId,
            userId,
            isCorrect,
            optionSelected: submission
        });
        
        // Only award points if answer is correct
        if (isCorrect) {
            const timeTaken = new Date().getTime() - problem.startTime;
            const timeBonus = Math.max(0, 1000 - (500 * timeTaken / (PROBLEM_TIME_S * 1000)));
            user.points += Math.floor(timeBonus);
        }
        
        return true;
    }

    /*
    Gets the leaderboard of the quiz, sorted by user points in descending order.

    @returns {Array} - The leaderboard of the quiz.
    */

    getLeaderboard() {
        return this.users.sort((a, b) => a.points < b.points ? 1 : -1).slice(0, 20);;
    }

    /*
    Gets the current state of the quiz.

    @returns {Object} - The current state of the quiz.
    */

    getCurrentState() {
        if (this.currentState === "not_started") {
            return {
                type: "not_started"
            }
        }
        if (this.currentState === "ended") {
            return {
                type: "ended",
                leaderboard: this.getLeaderboard()
            }
        }
        if (this.currentState === "leaderboard") {
            return {
                type: "leaderboard",
                leaderboard: this.getLeaderboard()
            }
        }
        if (this.currentState === "question") {
            const problem = this.problems[this.activeProblem];
            return {
                type: "question",
                problem
            }
        }
    }



}
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { useSocket } from '../contexts/useSocket';
import type { AllowedSubmissions, User, Problem } from '../types/types';

export const Quiz = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { quizState, submitAnswer, bulkSubmit, userId } = useSocket();
  const [connectionTimeout, setConnectionTimeout] = useState(false);

  useEffect(() => { if (!roomId) navigate('/'); }, [roomId, navigate]);

  useEffect(() => {
    if (quizState) { setConnectionTimeout(false); return; }
    const t = setTimeout(() => setConnectionTimeout(true), 5000);
    return () => clearTimeout(t);
  }, [quizState]);

  if (!quizState) {
    if (connectionTimeout)
      return <StatusCard title="Room Not Found" description={`Room "${roomId}" doesn't exist.`}
        action={<><Button variant="outline" onClick={() => window.location.reload()}>Retry</Button><Button onClick={() => navigate('/')}>Go Home</Button></>} />;
    return <StatusCard title="Connecting…" description={`Joining room ${roomId}…`} loading
      action={<Button variant="outline" onClick={() => navigate('/')}>Cancel</Button>} />;
  }

  if (quizState.type === 'room_not_found')
    return <StatusCard title="Room Not Found" description="Ask the admin to create this room first."
      action={<Button onClick={() => navigate('/')}>Go Home</Button>} />;

  if (quizState.type === 'not_started')
    return <StatusCard title="Waiting for quiz to start" description={`Room: ${roomId}`} pulse />;

  if (quizState.type === 'scheduled') {
    const startsAt = new Date(quizState.scheduledStartTime).toLocaleString();
    return <StatusCard title="Quiz Scheduled" description={`Starts at ${startsAt}`} pulse />;
  }

  if (quizState.type === 'question') {
    const duration = quizState.config.durationPerQuestion ?? 30;

    // If user joined during the join window, give them the FULL question duration
    // Otherwise use the server-provided deadline
    let effectiveDeadline = quizState.questionDeadline;
    const now = Date.now();
    const joinWindowStillOpen =
      quizState.joinWindowEndTime != null && now < quizState.joinWindowEndTime;

    if (joinWindowStillOpen) {
      // User just joined — give them full duration from now
      effectiveDeadline = now + duration * 1000;
    }

    return (
      <PerQuestionMode
        roomId={roomId!}
        problem={quizState.problem}
        questionIndex={quizState.questionIndex}
        totalQuestions={quizState.totalQuestions}
        questionDeadline={effectiveDeadline}
        isLastQuestion={quizState.questionIndex === quizState.totalQuestions - 1}
        onSubmit={(option) => submitAnswer(roomId!, quizState.problem.id, option)}
        onSkip={() => submitAnswer(roomId!, quizState.problem.id, null)}
      />
    );
  }

  if (quizState.type === 'free_attempt') {
    // Handle join window - adjust deadline if user joined during window
    let adjustedDeadline = quizState.quizDeadline;
    if (quizState.quizStartTime && quizState.joinWindowEndTime && Date.now() < quizState.joinWindowEndTime) {
      const totalDuration = quizState.config.totalDuration ?? 1800;
      adjustedDeadline = quizState.quizStartTime + totalDuration * 1000;
    }
    
    return (
      <FreeAttemptMode
        roomId={roomId!}
        problems={quizState.problems}
        quizDeadline={adjustedDeadline}
        onFinish={(answers) => bulkSubmit(roomId!, answers)}
      />
    );
  }

  if (quizState.type === 'ended') {
    const userScore = quizState.leaderboard.find((u) => u.id === userId);
    const sorted = [...quizState.leaderboard].sort((a, b) =>
      b.points !== a.points ? b.points - a.points : a.totalTimeTaken - b.totalTimeTaken
    );
    const userRank = userScore ? sorted.findIndex((u) => u.id === userId) + 1 : null;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 flex items-center justify-center p-3 sm:p-4 md:p-6">
        <Card className="w-full max-w-2xl border-2 border-blue-300 shadow-xl bg-white">
          <CardHeader className="text-center pb-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl font-bold text-white">Quiz Complete!</CardTitle>
            <CardDescription className="text-blue-100 mt-1 text-sm sm:text-base">Your Results</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {userScore ? (
              <UserScoreView user={userScore} rank={userRank} totalParticipants={quizState.leaderboard.length} />
            ) : (
              <div className="text-center py-8 text-blue-800">
                <p>Your results are being processed...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

// ─── Per-question mode ────────────────────────────────────────────────────────

interface PerQuestionProps {
  roomId: string;
  problem: Problem;
  questionIndex: number;
  totalQuestions: number;
  questionDeadline: number;
  isLastQuestion: boolean;
  onSubmit: (option: AllowedSubmissions) => void;
  onSkip: () => void;
}

const PerQuestionMode = ({
  problem,
  questionIndex,
  totalQuestions,
  questionDeadline,
  isLastQuestion,
  onSubmit,
  onSkip,
}: PerQuestionProps) => {
  const [selectedOption, setSelectedOption] = useState<AllowedSubmissions | null>(null);
  const [hasActed, setHasActed] = useState(false);
  // effectiveDeadline is set once when the component mounts for a question
  // so that late-joining users retain their full allocated time
  const [effectiveDeadline] = useState<number>(questionDeadline);
  const [timeLeft, setTimeLeft] = useState<number>(() =>
    Math.max(0, Math.round((questionDeadline - Date.now()) / 1000))
  );
  // Track when this question started for the user (for per-question ms timing)
  const questionStartRef = useRef<number>(Date.now());

  // Reset on new question
  useEffect(() => {
    setSelectedOption(null);
    setHasActed(false);
    setTimeLeft(Math.max(0, Math.round((effectiveDeadline - Date.now()) / 1000)));
    questionStartRef.current = Date.now();
  }, [problem.id, effectiveDeadline]);

  // Countdown
  useEffect(() => {
    if (hasActed) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((effectiveDeadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 500);
    return () => clearInterval(interval);
  }, [effectiveDeadline, hasActed]);

  const handleSubmit = () => {
    if (selectedOption === null || hasActed) return;
    setHasActed(true);
    onSubmit(selectedOption);
  };

  const handleSkip = () => {
    if (hasActed) return;
    setHasActed(true);
    onSkip();
  };

  const timeCritical = timeLeft <= 5;
  const duration = Math.round((effectiveDeadline - questionStartRef.current) / 1000);
  const progress = duration > 0 ? ((duration - timeLeft) / duration) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 p-3 sm:p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Progress bar */}
        <Card className="border-2 border-blue-200 shadow-sm bg-white">
          <CardContent className="py-3 sm:py-4">
            <div className="flex items-center justify-between mb-2 sm:mb-3 flex-wrap gap-2">
              <span className="text-xs sm:text-sm font-medium text-blue-900">
                Question {questionIndex + 1} of {totalQuestions}
              </span>
              <Badge 
                variant={timeCritical ? 'destructive' : 'default'} 
                className={`tabular-nums px-2 sm:px-3 py-1 text-xs sm:text-sm ${timeCritical ? 'bg-red-600' : 'bg-blue-600'}`}
              >
                {timeLeft}s
              </Badge>
            </div>
            <Progress 
              value={progress} 
              className={`h-2 ${timeCritical ? '[&>div]:bg-red-600' : '[&>div]:bg-blue-600'}`} 
            />
          </CardContent>
        </Card>

        {/* Question */}
        <Card className="border-2 border-blue-200 shadow-lg bg-white">
          <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
              <div className="flex-1 w-full">
                <CardTitle className="text-lg sm:text-xl leading-tight text-black font-semibold">{problem.title}</CardTitle>
                <CardDescription className="mt-2 text-sm sm:text-base text-blue-800 leading-relaxed">{problem.description}</CardDescription>
              </div>
              <Badge variant="outline" className="shrink-0 bg-blue-600 text-white border-0 px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold">
                {problem.score} pts
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 px-3 sm:px-6">
            {hasActed && (
              <div className="rounded-lg border-2 border-blue-300 bg-blue-50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-blue-900 font-medium shadow-sm">
                {selectedOption !== null
                  ? isLastQuestion
                    ? 'Answer submitted! Quiz complete, waiting for results…'
                    : 'Answer submitted! Moving to next question…'
                  : isLastQuestion
                    ? 'Skipped. Quiz complete, waiting for results…'
                    : 'Skipped. Moving to next question…'}
              </div>
            )}

            {problem.options.map((option) => {
              const isSelected = selectedOption === option.id;
              return (
                <button
                  key={option.id}
                  disabled={hasActed || timeLeft === 0}
                  onClick={() => !hasActed && setSelectedOption(option.id as AllowedSubmissions)}
                  className={`w-full rounded-xl border-2 px-3 sm:px-5 py-3 sm:py-4 text-left transition-all flex items-center gap-3 sm:gap-4 shadow-sm
                    ${isSelected 
                      ? 'border-blue-600 bg-blue-50 font-medium shadow-md ring-2 ring-blue-300' 
                      : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md'
                    }
                    ${hasActed ? 'cursor-default opacity-75' : 'cursor-pointer'}
                    disabled:opacity-50`}
                >
                  <span className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full text-xs sm:text-sm font-bold transition-all
                    ${isSelected 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-blue-100 text-blue-800'
                    }`}>
                    {String.fromCharCode(65 + option.id)}
                  </span>
                  <span className="flex-1 text-sm sm:text-base text-black">{option.title}</span>
                  {hasActed && isSelected && <span className="text-blue-600 text-lg sm:text-xl font-bold">✓</span>}
                </button>
              );
            })}

            {!hasActed && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 sm:mt-4 pt-2">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-md text-sm sm:text-base"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={selectedOption === null || timeLeft === 0}
                >
                  {timeLeft === 0 ? "Time's Up!" : isLastQuestion ? 'Submit & Finish Quiz' : 'Submit Answer'}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleSkip}
                  disabled={timeLeft === 0}
                  className="border-blue-300 hover:bg-blue-50 text-blue-700 text-sm sm:text-base"
                >
                  {isLastQuestion ? 'Skip & Finish' : 'Skip →'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ─── Free-attempt (total timer) mode ─────────────────────────────────────────

interface FreeAttemptProps {
  roomId: string;
  problems: Problem[];
  quizDeadline: number;
  onFinish: (answers: { problemId: string; optionSelected: AllowedSubmissions; timeTaken?: number }[]) => void;
}

const FreeAttemptMode = ({ problems, quizDeadline, onFinish }: FreeAttemptProps) => {
  const [answers, setAnswers] = useState<Record<string, AllowedSubmissions>>({});
  const [questionViewTimes, setQuestionViewTimes] = useState<Record<string, number>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(() =>
    Math.max(0, Math.round((quizDeadline - Date.now()) / 1000))
  );
  const [finished, setFinished] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Track time spent per question in ms
  const [questionTimeSpent, setQuestionTimeSpent] = useState<Record<string, number>>({});
  const questionStartTimeRef = useRef<number>(Date.now());

  // Countdown
  useEffect(() => {
    if (finished) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((quizDeadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        handleFinish();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [quizDeadline, finished]);

  const activeProblem = problems[activeIdx];

  // Track time when user switches questions
  useEffect(() => {
    const prevProblem = problems[activeIdx > 0 ? activeIdx - 1 : -1];
    if (prevProblem) {
      const timeSpent = Date.now() - questionStartTimeRef.current;
      setQuestionTimeSpent((prev) => ({
        ...prev,
        [prevProblem.id]: (prev[prevProblem.id] || 0) + timeSpent,
      }));
    }
    questionStartTimeRef.current = Date.now();
    if (activeProblem && !questionViewTimes[activeProblem.id]) {
      setQuestionViewTimes((prev) => ({ ...prev, [activeProblem.id]: Date.now() }));
    }
  }, [activeIdx]);

  const handleFinish = () => {
    if (finished) return;
    const currentProblem = problems[activeIdx];
    if (currentProblem) {
      const timeSpent = Date.now() - questionStartTimeRef.current;
      setQuestionTimeSpent((prev) => ({
        ...prev,
        [currentProblem.id]: (prev[currentProblem.id] || 0) + timeSpent,
      }));
    }
    setFinished(true);
    // timeTaken is in ms
    const answerList = Object.entries(answers).map(([problemId, optionSelected]) => ({
      problemId,
      optionSelected,
      timeTaken: questionTimeSpent[problemId] || 0,
    }));
    onFinish(answerList);
  };

  const answeredCount = Object.keys(answers).length;
  const totalMinutes = Math.floor(timeLeft / 60);
  const totalSeconds = timeLeft % 60;
  const timeCritical = timeLeft <= 60;

  if (finished) {
    return (
      <StatusCard
        title="Quiz Submitted!"
        description="Your answers have been submitted. Waiting for results…"
        pulse
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Top bar: timer + progress */}
        <Card className="border-2 border-blue-200 shadow-lg bg-white">
          <CardContent className="py-3 sm:py-4 px-3 sm:px-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-3">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <Badge 
                  variant={timeCritical ? 'destructive' : 'default'} 
                  className={`tabular-nums text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-1.5 font-semibold ${timeCritical ? 'bg-red-600' : 'bg-blue-600'}`}
                >
                  {String(totalMinutes).padStart(2, '0')}:{String(totalSeconds).padStart(2, '0')}
                </Badge>
                <span className="text-xs sm:text-sm font-medium text-blue-900">
                  {answeredCount} / {problems.length} answered
                </span>
              </div>
              <Button
                size="sm"
                variant={activeIdx === problems.length - 1 ? 'default' : 'outline'}
                onClick={() => setShowConfirm(true)}
                disabled={finished}
                className={`text-xs sm:text-sm ${activeIdx === problems.length - 1 ? 'bg-blue-600 hover:bg-blue-700' : 'border-blue-300 text-blue-700'}`}
              >
                Finish Quiz
              </Button>
            </div>

            {/* Question navigator dots */}
            <div className="flex gap-1.5 sm:gap-2 flex-wrap">
              {problems.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setActiveIdx(i)}
                  className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-sm
                    ${i === activeIdx 
                      ? 'ring-2 ring-blue-600 ring-offset-1 sm:ring-offset-2 bg-blue-600 text-white scale-110' 
                      : ''
                    }
                    ${answers[p.id] !== undefined
                      ? i === activeIdx 
                        ? '' 
                        : 'bg-blue-500 text-white'
                      : i === activeIdx
                        ? ''
                        : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                    }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active question */}
        {activeProblem && (
          <Card className="border-2 border-blue-200 shadow-lg bg-white">
            <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                <div className="flex-1 w-full">
                  <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">
                    QUESTION {activeIdx + 1} OF {problems.length}
                  </p>
                  <CardTitle className="text-lg sm:text-xl leading-tight text-black font-semibold">{activeProblem.title}</CardTitle>
                  <CardDescription className="mt-2 text-sm sm:text-base text-blue-800 leading-relaxed">{activeProblem.description}</CardDescription>
                </div>
                <Badge variant="outline" className="shrink-0 bg-blue-600 text-white border-0 px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold">
                  {activeProblem.score} pts
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 px-3 sm:px-6">
              {activeProblem.options.map((option) => {
                const isSelected = answers[activeProblem.id] === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [activeProblem.id]: option.id as AllowedSubmissions }))
                    }
                    className={`w-full rounded-xl border-2 px-3 sm:px-5 py-3 sm:py-4 text-left transition-all flex items-center gap-3 sm:gap-4 shadow-sm cursor-pointer
                      ${isSelected 
                        ? 'border-blue-600 bg-blue-50 font-medium shadow-md ring-2 ring-blue-300' 
                        : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md'
                      }`}
                  >
                    <span className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full text-xs sm:text-sm font-bold transition-all
                      ${isSelected 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-blue-100 text-blue-800'
                      }`}>
                      {String.fromCharCode(65 + option.id)}
                    </span>
                    <span className="flex-1 text-sm sm:text-base text-black">{option.title}</span>
                    {isSelected && <span className="text-blue-600 text-lg sm:text-xl font-bold">✓</span>}
                  </button>
                );
              })}

              {/* Prev / Next navigation */}
              <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-blue-200">
                <Button
                  variant="outline"
                  onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                  disabled={activeIdx === 0}
                  className="border-blue-300 hover:bg-blue-50 text-blue-700 text-sm sm:text-base"
                >
                  ← Previous
                </Button>
                {activeIdx < problems.length - 1 ? (
                  <Button 
                    onClick={() => setActiveIdx((i) => i + 1)}
                    className="bg-blue-600 hover:bg-blue-700 text-sm sm:text-base"
                  >
                    Next →
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setShowConfirm(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-sm sm:text-base"
                  >
                    Finish Quiz
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirm finish modal */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle>Submit Quiz?</CardTitle>
                <CardDescription>
                  You have answered {answeredCount} of {problems.length} questions.
                  {answeredCount < problems.length && (
                    <span className="text-amber-600 font-medium">
                      {' '}{problems.length - answeredCount} unanswered question{problems.length - answeredCount !== 1 ? 's' : ''} will be skipped.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowConfirm(false)}>Go Back</Button>
                <Button onClick={() => { setShowConfirm(false); handleFinish(); }}>Submit Now</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

const UserScoreView = ({
  user, rank, totalParticipants,
}: {
  user: User;
  rank: number | null;
  totalParticipants: number;
}) => {
  const formatTime = (ms: number) => {
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const timeScore = Math.max(0, 1000 - (user.totalTimeTaken / 1000));
  const finalScore = user.points * 1000 + timeScore;

  return (
    <div className="space-y-4">
      <div className="text-center mb-4 sm:mb-6">
        <div className={`inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full text-xl sm:text-2xl font-bold mb-2 sm:mb-3
          ${rank === 1 ? 'bg-blue-700 text-white shadow-lg' :
            rank === 2 ? 'bg-blue-600 text-white shadow-md' :
            rank === 3 ? 'bg-blue-500 text-white shadow-md' :
            'bg-blue-100 text-blue-800'
          }`}>
          #{rank || '?'}
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-black mb-1">{user.name}</h3>
        <p className="text-xs sm:text-sm text-blue-700">Out of {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-blue-700 mb-1">Points</div>
          <div className="text-2xl sm:text-3xl font-bold text-black">{user.points}</div>
        </div>
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-blue-700 mb-1">Time Taken</div>
          <div className="text-2xl sm:text-3xl font-bold text-black">{formatTime(user.totalTimeTaken)}</div>
        </div>
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-blue-700 mb-1">Correct Answers</div>
          <div className="text-2xl sm:text-3xl font-bold text-black">{user.correctAnswers}/{user.totalAnswered}</div>
        </div>
        <div className="rounded-xl border-2 border-blue-300 bg-blue-100 p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-blue-800 mb-1 font-semibold">Final Score</div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-900">{finalScore.toFixed(0)}</div>
        </div>
      </div>
    </div>
  );
};

const StatusCard = ({
  title, description, action, loading, pulse,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  loading?: boolean;
  pulse?: boolean;
}) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 flex items-center justify-center p-4">
    <Card className="w-full max-w-md text-center border-2 border-blue-200 shadow-xl bg-white">
      <CardHeader className="pb-4">
        {loading && <div className="mx-auto mb-4 animate-spin h-10 w-10 rounded-full border-4 border-blue-600 border-t-transparent" />}
        {pulse && <div className="mx-auto mb-4 h-4 w-4 rounded-full bg-blue-600 animate-pulse shadow-lg" />}
        <CardTitle className="text-xl font-semibold text-black">{title}</CardTitle>
        {description && <CardDescription className="mt-2 text-blue-800">{description}</CardDescription>}
      </CardHeader>
      {action && <CardContent className="flex gap-3 justify-center pt-2">{action}</CardContent>}
    </Card>
  </div>
);
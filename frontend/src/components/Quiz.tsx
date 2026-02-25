import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { useSocket } from '../contexts/useSocket';
import { QuizLoadingSkeleton } from './LoadingStates';
import type { AllowedSubmissions, User, Problem } from '../types/types';

export const Quiz = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { quizState, submitAnswer, bulkSubmit, userId } = useSocket();
  const [connectionTimeout, setConnectionTimeout] = useState(false);

  useEffect(() => {
    if (!roomId) {
      toast.error('No room ID provided');
      navigate('/');
    }
  }, [roomId, navigate]);

  useEffect(() => {
    if (quizState) {
      setConnectionTimeout(false);
      return;
    }
    const t = setTimeout(() => setConnectionTimeout(true), 5000);
    return () => clearTimeout(t);
  }, [quizState]);

  if (!quizState) {
    if (connectionTimeout) {
      return (
        <StatusCard
          title="Room Not Found"
          description={`Unable to find quiz room "${roomId}"`}
          action={
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry Connection
              </Button>
              <Button onClick={() => navigate('/')}>Return Home</Button>
            </div>
          }
        />
      );
    }
    return <QuizLoadingSkeleton />;
  }

  if (quizState.type === 'room_not_found') {
    return (
      <StatusCard
        title="Room Not Found"
        description="This quiz room doesn't exist. Please check your room ID."
        action={<Button onClick={() => navigate('/')}>Return Home</Button>}
      />
    );
  }

  if (quizState.type === 'not_started') {
    return (
      <StatusCard
        title="Waiting for Quiz to Start"
        description={`You're in room: ${roomId}`}
        pulse
      />
    );
  }

  if (quizState.type === 'scheduled') {
    const startsAt = new Date(quizState.scheduledStartTime).toLocaleString();
    return (
      <StatusCard
        title="Quiz Scheduled"
        description={`This quiz will start at ${startsAt}`}
        pulse
      />
    );
  }

  if (quizState.type === 'question') {
    const duration = quizState.config.durationPerQuestion ?? 30;
    let effectiveDeadline = quizState.questionDeadline;
    const now = Date.now();
    const joinWindowStillOpen =
      quizState.joinWindowEndTime != null && now < quizState.joinWindowEndTime;

    if (joinWindowStillOpen) {
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
    let adjustedDeadline = quizState.quizDeadline;
    if (
      quizState.quizStartTime &&
      quizState.joinWindowEndTime &&
      Date.now() < quizState.joinWindowEndTime
    ) {
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
      <div className="min-h-screen w-full bg-gradient-to-br from-background via-secondary/10 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-2xl">
          <CardHeader className="text-center space-y-2 bg-gradient-to-r from-primary/10 to-primary/5 border-b">
            <CardTitle className="text-3xl md:text-4xl font-bold">Quiz Complete!</CardTitle>
            <CardDescription className="text-base">Your Results</CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8">
            {userScore ? (
              <UserScoreView
                user={userScore}
                rank={userRank}
                totalParticipants={quizState.leaderboard.length}
              />
            ) : (
              <div className="text-center py-12 space-y-4">
                <div className="h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                <p className="text-muted-foreground">Processing your results...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

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
  const [effectiveDeadline] = useState<number>(questionDeadline);
  const [timeLeft, setTimeLeft] = useState<number>(() =>
    Math.max(0, Math.round((questionDeadline - Date.now()) / 1000))
  );
  const questionStartRef = useRef<number>(Date.now());

  useEffect(() => {
    setSelectedOption(null);
    setHasActed(false);
    setTimeLeft(Math.max(0, Math.round((effectiveDeadline - Date.now()) / 1000)));
    questionStartRef.current = Date.now();
  }, [problem.id, effectiveDeadline]);

  useEffect(() => {
    if (hasActed) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((effectiveDeadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        toast.warning('Time is up!');
      }
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
    toast.info('Question skipped');
  };

  const timeCritical = timeLeft <= 5;
  const duration = Math.round((effectiveDeadline - questionStartRef.current) / 1000);
  const progress = duration > 0 ? ((duration - timeLeft) / duration) * 100 : 0;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-secondary/10 to-background p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="shadow-lg border-border/50">
          <CardContent className="py-4 md:py-5">
            <div className="flex items-center justify-between mb-3 gap-4">
              <span className="text-sm md:text-base font-semibold text-foreground">
                Question {questionIndex + 1} of {totalQuestions}
              </span>
              <Badge
                variant={timeCritical ? 'destructive' : 'default'}
                className={`tabular-nums px-3 md:px-4 py-1.5 text-sm md:text-base font-bold ${
                  timeCritical ? 'animate-pulse' : ''
                }`}
              >
                {timeLeft}s
              </Badge>
            </div>
            <Progress
              value={progress}
              className={`h-2.5 transition-all duration-300 ${
                timeCritical ? '[&>div]:bg-destructive' : ''
              }`}
            />
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-border/50">
          <CardHeader className="space-y-3 pb-4 md:pb-5">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <CardTitle className="text-xl md:text-2xl lg:text-3xl leading-tight">
                  {problem.title}
                </CardTitle>
                {problem.description && (
                  <CardDescription className="text-sm md:text-base leading-relaxed">
                    {problem.description}
                  </CardDescription>
                )}
              </div>
              <Badge variant="secondary" className="shrink-0 px-3 md:px-4 py-1.5 text-sm md:text-base font-bold">
                {problem.score} points
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 md:space-y-4">
            {hasActed && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm md:text-base text-primary font-medium shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                {selectedOption !== null
                  ? isLastQuestion
                    ? 'Answer submitted! Waiting for results...'
                    : 'Answer submitted! Loading next question...'
                  : isLastQuestion
                    ? 'Question skipped. Waiting for results...'
                    : 'Question skipped. Loading next question...'}
              </div>
            )}

            <div className="grid gap-3 md:gap-4">
              {problem.options.map((option) => {
                const isSelected = selectedOption === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={hasActed || timeLeft === 0}
                    onClick={() => !hasActed && setSelectedOption(option.id as AllowedSubmissions)}
                    className={`group relative w-full rounded-xl border-2 px-4 md:px-6 py-4 md:py-5 text-left transition-all duration-200 flex items-center gap-3 md:gap-4 shadow-sm hover:shadow-md
                      ${
                        isSelected
                          ? 'border-primary bg-primary/5 font-semibold shadow-lg ring-2 ring-primary/30 scale-[1.02]'
                          : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/30'
                      }
                      ${hasActed || timeLeft === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div
                      className={`flex-shrink-0 h-5 w-5 md:h-6 md:w-6 rounded-full border-2 transition-all duration-200 flex items-center justify-center
                        ${
                          isSelected
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground/50 bg-background group-hover:border-primary/70'
                        }
                      `}
                    >
                      {isSelected && (
                        <div className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-primary-foreground" />
                      )}
                    </div>
                    <span className="text-sm md:text-base lg:text-lg flex-1">{option.title}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSkip}
                disabled={hasActed || timeLeft === 0}
                variant="outline"
                size="lg"
                className="flex-1 h-12 md:h-14 text-base md:text-lg font-semibold"
              >
                Skip Question
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={selectedOption === null || hasActed || timeLeft === 0}
                size="lg"
                className="flex-1 h-12 md:h-14 text-base md:text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Submit Answer →
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface FreeAttemptProps {
  roomId: string;
  problems: Problem[];
  quizDeadline: number;
  onFinish: (answers: { problemId: string; optionSelected: AllowedSubmissions; timeTaken?: number }[]) => void;
}

const FreeAttemptMode = ({ problems, quizDeadline, onFinish }: FreeAttemptProps) => {
  const [answers, setAnswers] = useState<Map<string, AllowedSubmissions>>(new Map());
  const [questionTimings, setQuestionTimings] = useState<Map<string, number>>(new Map());
  const [timeLeft, setTimeLeft] = useState<number>(() =>
    Math.max(0, Math.round((quizDeadline - Date.now()) / 1000))
  );
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const quizStartRef = useRef(Date.now());

  useEffect(() => {
    const timings = new Map<string, number>();
    problems.forEach((p) => timings.set(p.id, 0));
    setQuestionTimings(timings);
  }, [problems]);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((quizDeadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        if (!hasSubmitted) {
          handleFinish();
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [quizDeadline, hasSubmitted]);

  const handleSelectOption = (problemId: string, optionId: AllowedSubmissions) => {
    setAnswers((prev) => {
      const updated = new Map(prev);
      if (updated.get(problemId) === optionId) {
        updated.delete(problemId);
      } else {
        updated.set(problemId, optionId);
        if (!questionTimings.has(problemId)) {
          setQuestionTimings((prevTimings) => {
            const newTimings = new Map(prevTimings);
            newTimings.set(problemId, Date.now() - quizStartRef.current);
            return newTimings;
          });
        }
      }
      return updated;
    });
  };

  const handleFinish = () => {
    if (hasSubmitted) return;
    setHasSubmitted(true);

    const answerArray = Array.from(answers.entries()).map(([problemId, optionSelected]) => ({
      problemId,
      optionSelected,
      timeTaken: questionTimings.get(problemId) || 0,
    }));

    onFinish(answerArray);
    toast.success('Quiz submitted successfully!');
  };

  const answered = answers.size;
  const totalQuestions = problems.length;
  const progress = (answered / totalQuestions) * 100;
  const timeCritical = timeLeft <= 30;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-secondary/10 to-background p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="shadow-lg border-border/50 sticky top-4 z-10 bg-card/95 backdrop-blur-sm">
          <CardContent className="py-4 md:py-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-3">
              <div className="text-center sm:text-left">
                <p className="text-sm md:text-base font-semibold text-foreground">
                  {answered} of {totalQuestions} answered
                </p>
                <Progress value={progress} className="h-2 w-48 mt-1.5" />
              </div>
              <Badge
                variant={timeCritical ? 'destructive' : 'default'}
                className={`tabular-nums px-4 py-2 text-base md:text-lg font-bold ${
                  timeCritical ? 'animate-pulse' : ''
                }`}
              >
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </Badge>
            </div>
            <Button
              onClick={handleFinish}
              disabled={hasSubmitted || answered === 0}
              size="lg"
              className="w-full h-12 md:h-14 text-base md:text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {hasSubmitted ? 'Submitted!' : `Submit Quiz (${answered}/${totalQuestions})`}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {problems.map((problem, index) => {
            const selectedOption = answers.get(problem.id);
            const isAnswered = selectedOption !== undefined;

            return (
              <Card
                key={problem.id}
                className={`shadow-xl border-2 transition-all duration-200 ${
                  isAnswered ? 'border-primary/50 bg-primary/5' : 'border-border/50'
                }`}
              >
                <CardHeader className="space-y-3 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Badge variant={isAnswered ? 'default' : 'secondary'} className="text-xs md:text-sm">
                          Q{index + 1}
                        </Badge>
                        <CardTitle className="text-lg md:text-xl lg:text-2xl leading-tight">
                          {problem.title}
                        </CardTitle>
                      </div>
                      {problem.description && (
                        <CardDescription className="text-sm md:text-base leading-relaxed pl-11">
                          {problem.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0 px-3 py-1.5 text-sm font-bold">
                      {problem.score} pts
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="grid gap-3">
                    {problem.options.map((option) => {
                      const isSelected = selectedOption === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={hasSubmitted}
                          onClick={() =>
                            !hasSubmitted && handleSelectOption(problem.id, option.id as AllowedSubmissions)
                          }
                          className={`group relative w-full rounded-lg border-2 px-4 md:px-5 py-3 md:py-4 text-left transition-all duration-200 flex items-center gap-3
                            ${
                              isSelected
                                ? 'border-primary bg-primary/10 font-semibold shadow-md ring-2 ring-primary/30'
                                : 'border-border bg-card hover:border-primary/50 hover:bg-secondary/30'
                            }
                            ${hasSubmitted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                        >
                          <div
                            className={`flex-shrink-0 h-5 w-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center
                              ${
                                isSelected
                                  ? 'border-primary bg-primary'
                                  : 'border-muted-foreground/50 bg-background group-hover:border-primary/70'
                              }
                            `}
                          >
                            {isSelected && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                          </div>
                          <span className="text-sm md:text-base flex-1">{option.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface UserScoreViewProps {
  user: User;
  rank: number | null;
  totalParticipants: number;
}

const UserScoreView = ({ user, rank, totalParticipants }: UserScoreViewProps) => {
  const accuracy = user.totalAnswered > 0 ? (user.correctAnswers / user.totalAnswered) * 100 : 0;
  const avgTimePerQuestion = user.totalAnswered > 0 ? user.totalTimeTaken / user.totalAnswered / 1000 : 0;

  const getRankBadge = () => {
    if (!rank) return null;
    if (rank === 1) return { emoji: '🥇', label: '1st Place', variant: 'default' as const };
    if (rank === 2) return { emoji: '🥈', label: '2nd Place', variant: 'secondary' as const };
    if (rank === 3) return { emoji: '🥉', label: '3rd Place', variant: 'secondary' as const };
    return { emoji: '🎯', label: `${rank}th Place`, variant: 'outline' as const };
  };

  const rankBadge = getRankBadge();

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="text-center space-y-4">
        {rankBadge && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-6xl md:text-7xl">{rankBadge.emoji}</div>
            <Badge variant={rankBadge.variant} className="text-base md:text-lg px-4 md:px-6 py-2">
              {rankBadge.label}
            </Badge>
          </div>
        )}
        <div>
          <h3 className="text-2xl md:text-3xl font-bold text-foreground">{user.name}</h3>
          <p className="text-muted-foreground mt-1">
            out of {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="text-center p-4 md:p-6 rounded-lg bg-primary/5 border border-primary/20">
          <div className="text-3xl md:text-4xl font-bold text-primary">{user.points}</div>
          <div className="text-xs md:text-sm text-muted-foreground mt-1">Total Points</div>
        </div>
        <div className="text-center p-4 md:p-6 rounded-lg bg-secondary/50 border border-border">
          <div className="text-3xl md:text-4xl font-bold text-foreground">{user.correctAnswers}</div>
          <div className="text-xs md:text-sm text-muted-foreground mt-1">Correct Answers</div>
        </div>
        <div className="text-center p-4 md:p-6 rounded-lg bg-secondary/50 border border-border">
          <div className="text-3xl md:text-4xl font-bold text-foreground">{accuracy.toFixed(0)}%</div>
          <div className="text-xs md:text-sm text-muted-foreground mt-1">Accuracy</div>
        </div>
        <div className="text-center p-4 md:p-6 rounded-lg bg-secondary/50 border border-border">
          <div className="text-3xl md:text-4xl font-bold text-foreground">{avgTimePerQuestion.toFixed(1)}s</div>
          <div className="text-xs md:text-sm text-muted-foreground mt-1">Avg Time</div>
        </div>
      </div>

      <div className="bg-secondary/30 rounded-lg p-4 md:p-6 space-y-2">
        <h4 className="font-semibold text-sm md:text-base text-foreground">Summary</h4>
        <div className="grid gap-2 text-xs md:text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Questions Attempted:</span>
            <span className="font-medium text-foreground">{user.totalAnswered}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Time Taken:</span>
            <span className="font-medium text-foreground">{(user.totalTimeTaken / 1000).toFixed(1)}s</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatusCardProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  loading?: boolean;
  pulse?: boolean;
}

const StatusCard = ({ title, description, action, loading, pulse }: StatusCardProps) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-secondary/10 to-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl">
        <CardHeader className="text-center space-y-3">
          {loading && (
            <div className="h-16 w-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          )}
          {pulse && (
            <div className="relative h-16 w-16 mx-auto">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="relative h-16 w-16 rounded-full bg-primary/30 flex items-center justify-center">
                <div className="h-8 w-8 rounded-full bg-primary animate-pulse" />
              </div>
            </div>
          )}
          <CardTitle className="text-2xl md:text-3xl font-bold">{title}</CardTitle>
          <CardDescription className="text-sm md:text-base">{description}</CardDescription>
        </CardHeader>
        {action && (
          <CardContent className="flex flex-col gap-3">
            {action}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

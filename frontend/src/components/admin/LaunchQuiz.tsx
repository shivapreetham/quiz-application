import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useSocket } from '../../contexts/useSocket';
import type { User } from '../../types/types';

interface Props {
  roomId: string;
  onBack: () => void;
}

export const LaunchQuiz = ({ roomId, onBack }: Props) => {
  const { admin } = useSocket();
  const { startQuiz, scheduleQuiz, currentQuizState, refreshQuizState, getAllSubmissionsForExport } = admin;

  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [mode, setMode] = useState<'choose' | 'schedule'>('choose');
  const [joinWindowDuration, setJoinWindowDuration] = useState(60); // seconds
  const [showJoinWindow, setShowJoinWindow] = useState(false);

  // Refresh state every 3s - continue even after quiz ends to show results
  useEffect(() => {
    refreshQuizState(roomId);
    const interval = setInterval(() => refreshQuizState(roomId), 3000);
    return () => clearInterval(interval);
  }, [roomId, refreshQuizState]);

  const handleStartNow = () => {
    if (showJoinWindow) {
      startQuiz(roomId, joinWindowDuration);
    } else {
      startQuiz(roomId);
    }
  };

  const handleSchedule = () => {
    if (!scheduledDate || !scheduledTime) { setScheduleError('Please pick a date and time'); return; }
    const ts = new Date(`${scheduledDate}T${scheduledTime}`).getTime();
    if (isNaN(ts) || ts <= Date.now()) { setScheduleError('Scheduled time must be in the future'); return; }
    scheduleQuiz(roomId, ts);
    setScheduleError('');
  };

  const state = currentQuizState;

  const downloadLeaderboard = async (leaderboard: User[]) => {
    // Request all submissions data from backend
    getAllSubmissionsForExport(roomId);
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get export data from window (set by socket listener)
    const exportData = (window as any).quizExportData;
    
    // Remove duplicates
    const uniqueUsers = leaderboard.filter((user, index, self) =>
      index === self.findIndex((u) => u.id === user.id)
    );
    
    const sorted = [...uniqueUsers].sort((a, b) =>
      b.points !== a.points ? b.points - a.points : a.totalTimeTaken - b.totalTimeTaken
    );
    
    // Get problems from export data or quiz state
    const problems = exportData?.problems || 
      (currentQuizState?.type === 'free_attempt' ? currentQuizState.problems : []);
    
    // Build CSV header with per-question columns
    const baseHeader = ['Rank', 'Name', 'Points', 'Total Time (s)', 'Correct', 'Total'];
    const questionHeaders: string[] = [];
    if (problems.length > 0) {
      for (let i = 1; i <= problems.length; i++) {
        questionHeaders.push(`Q${i} Time (s)`);
      }
    }
    const csvHeader = [...baseHeader, ...questionHeaders].join(',');
    
    // Build CSV rows with per-question times
    const csvRows = sorted.map((user, idx) => {
      const row = [
        idx + 1,
        user.name,
        user.points,
        (user.totalTimeTaken / 1000).toFixed(1),
        user.correctAnswers,
        user.totalAnswered,
      ];
      
      // Add per-question times from export data
      if (problems.length > 0 && exportData?.submissions) {
        const userSubmissions = exportData.submissions.find((s: any) => s.userId === user.id);
        const questionTimes = problems.map((problem: any) => {
          const submission = userSubmissions?.submissions.find((s: any) => s.problemId === problem.id);
          return submission ? (submission.timeTaken / 1000).toFixed(1) : '';
        });
        row.push(...questionTimes);
      }
      
      return row.join(',');
    });
    
    const csv = [csvHeader, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${roomId}-leaderboard-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>← Preview</Button>
        <div>
          <h2 className="text-xl font-bold">Launch — {roomId}</h2>
          <p className="text-muted-foreground text-sm">Start or schedule your quiz</p>
        </div>
      </div>

      {/* ── Launch controls (not yet started) ── */}
      {(!state || state.type === 'not_started') && (
        <Card>
          <CardHeader><CardTitle>Start Quiz</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {mode === 'choose' && !showJoinWindow && (
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  className="flex flex-col gap-1 rounded-lg border-2 border-border p-4 text-left hover:border-primary transition-colors"
                  onClick={() => setShowJoinWindow(true)}
                >
                  <span className="font-semibold">Start Now</span>
                  <span className="text-sm text-muted-foreground">Quiz begins immediately</span>
                </button>
                <button
                  className="flex flex-col gap-1 rounded-lg border-2 border-border p-4 text-left hover:border-primary transition-colors"
                  onClick={() => setMode('schedule')}
                >
                  <span className="font-semibold">Schedule</span>
                  <span className="text-sm text-muted-foreground">Pick a start date and time</span>
                </button>
              </div>
            )}
            {mode === 'choose' && showJoinWindow && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Join Window Duration (seconds)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={300}
                    value={joinWindowDuration}
                    onChange={(e) => setJoinWindowDuration(Number(e.target.value))}
                    placeholder="e.g. 60"
                  />
                  <p className="text-xs text-muted-foreground">
                    Users can join the quiz within this time after it starts. Set to 0 to disable join window.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowJoinWindow(false)}>Cancel</Button>
                  <Button onClick={handleStartNow}>Start Quiz</Button>
                </div>
              </div>
            )}
            {mode === 'schedule' && (
              <div className="space-y-3">
                {scheduleError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{scheduleError}</div>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Date</Label>
                    <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Time</Label>
                    <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setMode('choose')}>Cancel</Button>
                  <Button onClick={handleSchedule}>Schedule Quiz</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Scheduled ── */}
      {state?.type === 'scheduled' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-800">Quiz Scheduled</p>
              <p className="text-sm text-blue-700">Starts at {new Date(state.scheduledStartTime).toLocaleString()}</p>
            </div>
            <Button onClick={handleStartNow} variant="outline" className="border-blue-400">
              Start Now Instead
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Per-question mode: live ── */}
      {state?.type === 'question' && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-green-800">
                Live — Q{state.questionIndex + 1} of {state.totalQuestions}
              </CardTitle>
              <Badge className="bg-green-600">Per-question timer</Badge>
            </div>
            <CardDescription className="text-green-700">
              {state.problem.title}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-800">
              Quiz is running automatically — questions advance when participants submit, skip, or time runs out.
              No action needed from admin.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Total mode: live ── */}
      {state?.type === 'free_attempt' && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-green-800">Quiz Live</CardTitle>
              <Badge className="bg-green-600">Total timer</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-800">
              Participants are working through {state.totalQuestions} questions freely.
              The quiz ends when everyone finishes or the timer runs out.
              No action needed from admin.
            </p>
            <p className="text-sm text-green-700 mt-1 font-mono">
              Deadline: {new Date(state.quizDeadline).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Ended ── */}
      {state?.type === 'ended' && (
        <Card className="border-2 border-blue-200 shadow-lg bg-white">
          <CardHeader className="bg-blue-600 text-white rounded-t-lg px-3 sm:px-6">
            <CardTitle className="text-lg sm:text-xl font-bold text-white">Quiz Ended — Final Leaderboard</CardTitle>
            <CardDescription className="text-blue-100 mt-1 text-xs sm:text-sm">Complete results for all participants</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-3 sm:p-6">
            <LeaderboardList leaderboard={state.leaderboard} showFull />
            <Button
              onClick={() => downloadLeaderboard(state.leaderboard)}
              variant="outline"
              className="w-full border-blue-300 hover:bg-blue-50 text-blue-700 text-sm sm:text-base"
            >
              Download CSV
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const LeaderboardList = ({ leaderboard, showFull }: { leaderboard: User[]; showFull?: boolean }) => {
  // Remove duplicates by user ID
  const uniqueUsers = leaderboard.filter((user, index, self) =>
    index === self.findIndex((u) => u.id === user.id)
  );
  
  const sorted = [...uniqueUsers].sort((a, b) =>
    b.points !== a.points ? b.points - a.points : a.totalTimeTaken - b.totalTimeTaken
  );
  
  const shown = showFull ? sorted : sorted.slice(0, 5);
  
  const formatTime = (ms: number) => {
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      {shown.map((u, i) => {
        const timeScore = Math.max(0, 1000 - (u.totalTimeTaken / 1000));
        const finalScore = u.points * 1000 + timeScore;
        return (
          <div key={u.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 rounded-xl border-2 border-blue-200 bg-white px-3 sm:px-4 py-2 sm:py-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full sm:w-auto">
              <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full shrink-0 font-bold text-xs sm:text-sm
                ${i === 0 ? 'bg-blue-700 text-white' :
                  i === 1 ? 'bg-blue-600 text-white' :
                  i === 2 ? 'bg-blue-500 text-white' :
                  'bg-blue-100 text-blue-800'
                }`}>
                #{i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm sm:text-base text-black truncate">{u.name}</div>
                <div className="flex flex-wrap gap-2 sm:gap-3 text-xs text-blue-700 mt-1">
                  <span>Points: {u.points}</span>
                  <span>Time: {formatTime(u.totalTimeTaken)}</span>
                  <span>Correct: {u.correctAnswers}/{u.totalAnswered}</span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0 w-full sm:w-auto sm:ml-4 border-t sm:border-t-0 border-blue-200 pt-2 sm:pt-0">
              <div className="text-xs text-blue-700 mb-0.5">Final Score</div>
              <div className="font-bold text-base sm:text-lg text-black tabular-nums">{finalScore.toFixed(0)}</div>
            </div>
          </div>
        );
      })}
      {!showFull && sorted.length > 5 && (
        <p className="text-xs text-blue-700 text-center">+{sorted.length - 5} more</p>
      )}
    </div>
  );
};
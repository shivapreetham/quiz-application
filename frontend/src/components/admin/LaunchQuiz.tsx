import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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
  const {
    startQuiz,
    scheduleQuiz,
    currentQuizState,
    refreshQuizState,
    getAllSubmissionsForExport,
    liveLeaderboard,
    watchRoom,
  } = admin;

  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [mode, setMode] = useState<'choose' | 'schedule'>('choose');
  const [joinWindowDuration, setJoinWindowDuration] = useState(60);
  const [showJoinWindow, setShowJoinWindow] = useState(false);

  const joinUrl = window.location.origin + '/?room=' + encodeURIComponent(roomId);

  useEffect(() => {
    watchRoom(roomId);
    refreshQuizState(roomId);
    const interval = setInterval(() => refreshQuizState(roomId), 5000);
    return () => clearInterval(interval);
  }, [roomId, refreshQuizState, watchRoom]);

  const handleStartNow = () => {
    if (showJoinWindow) {
      startQuiz(roomId, joinWindowDuration);
    } else {
      startQuiz(roomId);
    }
  };

  const handleSchedule = () => {
    if (!scheduledDate || !scheduledTime) { setScheduleError('Please pick a date and time'); return; }
    const ts = new Date(scheduledDate + 'T' + scheduledTime).getTime();
    if (isNaN(ts) || ts <= Date.now()) { setScheduleError('Scheduled time must be in the future'); return; }
    scheduleQuiz(roomId, ts);
    setScheduleError('');
  };

  const downloadLeaderboard = async (leaderboard: User[]) => {
    getAllSubmissionsForExport(roomId);
    await new Promise(resolve => setTimeout(resolve, 500));
    const exportData = (window as any).quizExportData;

    const uniqueUsers = leaderboard.filter((user, index, self) =>
      index === self.findIndex((u) => u.id === user.id)
    );
    const sorted = [...uniqueUsers].sort((a, b) =>
      b.points !== a.points ? b.points - a.points : a.totalTimeTaken - b.totalTimeTaken
    );

    const problems = exportData?.problems ||
      (currentQuizState?.type === 'free_attempt' ? currentQuizState.problems : []);

    const baseHeader = ['Rank', 'Name', 'Points', 'Total Time (ms)', 'Correct', 'Total'];
    const questionHeaders: string[] = [];
    if (problems.length > 0) {
      for (let i = 1; i <= problems.length; i++) questionHeaders.push('Q' + i + ' Time (ms)');
    }
    const csvHeader = [...baseHeader, ...questionHeaders].join(',');

    const csvRows = sorted.map((user, idx) => {
      const row: (string | number)[] = [idx + 1, user.name, user.points, user.totalTimeTaken, user.correctAnswers, user.totalAnswered];
      if (problems.length > 0 && exportData?.submissions) {
        const userSubmissions = exportData.submissions.find((s: any) => s.user?.id === user.id || s.userId === user.id);
        const submissionList = userSubmissions?.submissions ?? [];
        const questionTimes = problems.map((problem: any) => {
          const submission = submissionList.find((s: any) => s.problemId === problem.id);
          return submission ? submission.timeTaken : '';
        });
        row.push(...questionTimes);
      }
      return row.join(',');
    });

    const csv = [csvHeader, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = roomId + '-leaderboard-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
  };

  const state = currentQuizState;
  const isLive = state?.type === 'question' || state?.type === 'free_attempt';
  const isScheduled = state?.type === 'scheduled';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>back Preview</Button>
        <div>
          <h2 className="text-xl font-bold">Launch -- {roomId}</h2>
          <p className="text-muted-foreground text-sm">Start or schedule your quiz</p>
        </div>
      </div>

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
                    Users can join within this time after start. Set 0 to disable.
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

      {isScheduled && state && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="py-4 space-y-3">
              <div>
                <p className="font-semibold text-blue-800">Quiz Scheduled</p>
                <p className="text-sm text-blue-700">
                  Starts at {new Date((state as any).scheduledStartTime).toLocaleString()}
                </p>
              </div>
              <Button onClick={handleStartNow} variant="outline" className="border-blue-400 w-full">
                Start Now Instead
              </Button>
            </CardContent>
          </Card>
          <QrCard joinUrl={joinUrl} roomId={roomId} />
        </div>
      )}

      {isLive && state && (
        <div className="space-y-4">
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-green-800">
                  {state.type === 'question'
                    ? 'Live -- Q' + ((state as any).questionIndex + 1) + ' of ' + (state as any).totalQuestions
                    : 'Quiz Live'}
                </CardTitle>
                <Badge className="bg-green-600">
                  {state.type === 'question' ? 'Per-question timer' : 'Total timer'}
                </Badge>
              </div>
              {state.type === 'question' && (
                <CardDescription className="text-green-700 mt-1">
                  {(state as any).problem.title}
                </CardDescription>
              )}
              {state.type === 'free_attempt' && (
                <CardDescription className="text-green-700 mt-1">
                  Deadline: {new Date((state as any).quizDeadline).toLocaleTimeString()}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-xs text-green-700">
                {state.type === 'question'
                  ? 'Each participant has the full timer to answer independently. Question advances when everyone answers or time runs out.'
                  : 'Participants are working through all questions freely.'}
              </p>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-3 gap-4">
            <QrCard joinUrl={joinUrl} roomId={roomId} />
            <div className="lg:col-span-2">
              <Card className="border-2 border-blue-200">
                <CardHeader className="bg-blue-600 text-white rounded-t-lg px-4 py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-white">Live Leaderboard</CardTitle>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-xs text-blue-100">Updates in real-time</span>
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  {liveLeaderboard.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Waiting for first submission...
                    </p>
                  ) : (
                    <LeaderboardList leaderboard={liveLeaderboard} />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {state?.type === 'ended' && (
        <Card className="border-2 border-blue-200 shadow-lg bg-white">
          <CardHeader className="bg-blue-600 text-white rounded-t-lg px-3 sm:px-6">
            <CardTitle className="text-lg sm:text-xl font-bold text-white">Quiz Ended -- Final Leaderboard</CardTitle>
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

const QrCard = ({ joinUrl, roomId }: { joinUrl: string; roomId: string }) => (
  <Card className="border-2 border-blue-200 bg-white">
    <CardHeader className="pb-2 px-4 pt-4">
      <CardTitle className="text-sm font-semibold text-blue-800">Join with QR Code</CardTitle>
      <CardDescription className="text-xs text-blue-600">
        Room: <span className="font-mono font-bold">{roomId}</span>
      </CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col items-center gap-3 pb-4 px-4">
      <div className="rounded-xl border-2 border-blue-100 p-3 bg-white shadow-sm">
        <QRCodeSVG
          value={joinUrl}
          size={160}
          bgColor="#ffffff"
          fgColor="#1e3a8a"
          level="M"
        />
      </div>
      <p className="text-xs text-muted-foreground text-center break-all max-w-full">{joinUrl}</p>
    </CardContent>
  </Card>
);

const LeaderboardList = ({ leaderboard, showFull }: { leaderboard: User[]; showFull?: boolean }) => {
  const uniqueUsers = leaderboard.filter((user, index, self) =>
    index === self.findIndex((u) => u.id === user.id)
  );

  const sorted = [...uniqueUsers].sort((a, b) =>
    b.points !== a.points ? b.points - a.points : a.totalTimeTaken - b.totalTimeTaken
  );

  const shown = showFull ? sorted : sorted.slice(0, 10);

  const formatTime = (ms: number) => {
    const seconds = ms / 1000;
    if (seconds < 60) return seconds.toFixed(1) + 's';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return minutes + 'm ' + secs + 's';
  };

  return (
    <div className="space-y-1.5 sm:space-y-2">
      {shown.map((u, i) => {
        const timeScore = Math.max(0, 1000 - (u.totalTimeTaken / 1000));
        const finalScore = u.points * 1000 + timeScore;
        return (
          <div
            key={u.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 shadow-sm"
          >
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className={
                'flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full shrink-0 font-bold text-xs ' +
                (i === 0 ? 'bg-yellow-400 text-yellow-900' :
                 i === 1 ? 'bg-slate-300 text-slate-800' :
                 i === 2 ? 'bg-orange-300 text-orange-900' :
                 'bg-blue-100 text-blue-700')
              }>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs sm:text-sm text-black truncate">{u.name}</div>
                <div className="flex flex-wrap gap-2 text-xs text-blue-600 mt-0.5">
                  <span>{u.points} pts</span>
                  <span>{formatTime(u.totalTimeTaken)}</span>
                  <span>{u.correctAnswers}/{u.totalAnswered} correct</span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-bold text-sm sm:text-base text-black tabular-nums">{finalScore.toFixed(0)}</div>
            </div>
          </div>
        );
      })}
      {!showFull && sorted.length > 10 && (
        <p className="text-xs text-blue-600 text-center pt-1">+{sorted.length - 10} more participants</p>
      )}
      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No participants yet</p>
      )}
    </div>
  );
};

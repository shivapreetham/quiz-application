import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useSocket } from '../../contexts/useSocket';
import type { QuizConfig, QuizDurationType } from '../../types/types';

interface Props {
  onCreated: (roomId: string) => void;
  onBack: () => void;
}

export const CreateQuiz = ({ onCreated, onBack }: Props) => {
  const { admin } = useSocket();
  const [roomId, setRoomId] = useState('');
  const [durationType, setDurationType] = useState<QuizDurationType>('per_question');
  const [durationPerQuestion, setDurationPerQuestion] = useState(30);
  const [totalDuration, setTotalDuration] = useState(30); // minutes
  const [pointsType, setPointsType] = useState<'same' | 'custom'>('same');
  const [defaultPoints, setDefaultPoints] = useState(10);
  const [error, setError] = useState('');

  const existingIds = new Set(admin.quizSummaries.map((q) => q.roomId));

  const handleCreate = () => {
    const id = roomId.trim();
    if (!id) { setError('Room ID is required'); return; }
    if (existingIds.has(id)) { setError('A quiz with this Room ID already exists'); return; }
    if (durationType === 'per_question' && durationPerQuestion < 5) {
      setError('Per-question timer must be at least 5 seconds'); return;
    }
    if (durationType === 'total' && totalDuration < 1) {
      setError('Total duration must be at least 1 minute'); return;
    }
    if (pointsType === 'same' && (defaultPoints < 1 || defaultPoints > 1000)) {
      setError('Default points must be between 1 and 1000'); return;
    }

    const config: QuizConfig = {
      durationType,
      durationPerQuestion: durationType === 'per_question' ? durationPerQuestion : undefined,
      totalDuration: durationType === 'total' ? totalDuration * 60 : undefined, // store as seconds
      pointsType,
      defaultPoints: pointsType === 'same' ? defaultPoints : undefined,
    };

    admin.createQuiz(id, config);
    admin.selectRoom(id);
    onCreated(id);
  };

  const optionBase = 'flex flex-col gap-1 rounded-lg border-2 p-4 cursor-pointer transition-all select-none';
  const sel = 'border-primary bg-primary/5';
  const unsel = 'border-border hover:border-primary/50';

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
        <div>
          <h2 className="text-2xl font-bold">Create Quiz</h2>
          <p className="text-muted-foreground text-sm">Configure your quiz room</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Room ID */}
      <Card>
        <CardHeader>
          <CardTitle>Room ID</CardTitle>
          <CardDescription>Participants will use this to join</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="e.g. cs101-quiz-1"
            value={roomId}
            onChange={(e) => { setRoomId(e.target.value); setError(''); }}
          />
        </CardContent>
      </Card>

      {/* Mode selection */}
      <Card>
        <CardHeader>
          <CardTitle>Quiz Mode</CardTitle>
          <CardDescription>Choose how time is managed during the quiz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">

          {/* Mode 1: Per question timer */}
          <div
            className={`${optionBase} ${durationType === 'per_question' ? sel : unsel}`}
            onClick={() => { setDurationType('per_question'); setError(''); }}
          >
            <span className="font-semibold">⏱ Per-Question Timer</span>
            <span className="text-sm text-muted-foreground">
              Each question has its own countdown. When time runs out (or the user submits/skips),
              it locks in and moves to the next question. Cannot go back.
            </span>
            {durationType === 'per_question' && (
              <div className="mt-3 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <Label className="whitespace-nowrap">Seconds per question</Label>
                <Input
                  type="number"
                  className="w-28"
                  min={5}
                  max={600}
                  value={durationPerQuestion}
                  onChange={(e) => setDurationPerQuestion(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          {/* Mode 2: Total quiz timer */}
          <div
            className={`${optionBase} ${durationType === 'total' ? sel : unsel}`}
            onClick={() => { setDurationType('total'); setError(''); }}
          >
            <span className="font-semibold">🕐 Total Quiz Timer</span>
            <span className="text-sm text-muted-foreground">
              One shared timer for the entire quiz. Participants can freely navigate between questions,
              change answers, and click Finish when ready (or when time runs out).
            </span>
            {durationType === 'total' && (
              <div className="mt-3 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <Label className="whitespace-nowrap">Total duration (minutes)</Label>
                <Input
                  type="number"
                  className="w-28"
                  min={1}
                  max={180}
                  value={totalDuration}
                  onChange={(e) => setTotalDuration(Number(e.target.value))}
                />
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Points configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Points Configuration</CardTitle>
          <CardDescription>Choose how points are assigned to questions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Option 1: Same points for all */}
          <div
            className={`${optionBase} ${pointsType === 'same' ? sel : unsel}`}
            onClick={() => { setPointsType('same'); setError(''); }}
          >
            <span className="font-semibold">📊 Same Points for All</span>
            <span className="text-sm text-muted-foreground">
              All questions will have the same point value. You'll set this value once.
            </span>
            {pointsType === 'same' && (
              <div className="mt-3 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <Label className="whitespace-nowrap">Points per question</Label>
                <Input
                  type="number"
                  className="w-28"
                  min={1}
                  max={1000}
                  value={defaultPoints}
                  onChange={(e) => setDefaultPoints(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          {/* Option 2: Custom points */}
          <div
            className={`${optionBase} ${pointsType === 'custom' ? sel : unsel}`}
            onClick={() => { setPointsType('custom'); setError(''); }}
          >
            <span className="font-semibold">✏️ Custom Points</span>
            <span className="text-sm text-muted-foreground">
              Each question can have its own point value. You'll set points individually when adding questions.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onBack}>Cancel</Button>
        <Button onClick={handleCreate} disabled={!roomId.trim()}>
          Create & Add Questions →
        </Button>
      </div>
    </div>
  );
};
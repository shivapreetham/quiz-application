import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useSocket } from '../../contexts/useSocket';
import type { AllowedSubmissions, ProblemInput } from '../../types/types';

interface Props {
  initial?: Partial<ProblemInput>;
  onSave: (problem: ProblemInput) => void;
  onCancel: () => void;
  saveLabel?: string;
}

const DEFAULT_OPTIONS = ['', '', '', ''];

export const ProblemForm = ({ initial, onSave, onCancel, saveLabel = 'Save Question' }: Props) => {
  const { admin } = useSocket();
  const config = admin.currentQuizConfig;
  const isSamePoints = config?.pointsType === 'same';
  const defaultScore = config?.defaultPoints ?? 10;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [options, setOptions] = useState<string[]>(
    initial?.options?.map((o) => o.title) ?? DEFAULT_OPTIONS,
  );
  const [correctAnswer, setCorrectAnswer] = useState<AllowedSubmissions>(initial?.answer ?? 0);
  const [score, setScore] = useState(
    initial?.score ?? (isSamePoints ? defaultScore : 10)
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (initial) {
      setTitle(initial.title ?? '');
      setDescription(initial.description ?? '');
      setOptions(initial.options?.map((o) => o.title) ?? DEFAULT_OPTIONS);
      setCorrectAnswer(initial.answer ?? 0);
      setScore(initial.score ?? (isSamePoints ? defaultScore : 10));
    } else if (isSamePoints) {
      // When adding a new question with same points mode, use default
      setScore(defaultScore);
    }
  }, [initial, isSamePoints, defaultScore]);

  const filledOptions = options.filter((o) => o.trim());

  const validate = (): string => {
    if (!title.trim()) return 'Question title is required';
    if (!description.trim()) return 'Question description is required';
    if (filledOptions.length < 2) return 'At least 2 options are required';
    if (!options[correctAnswer]?.trim()) return 'Correct answer option must be filled in';
    if (score < 1) return 'Score must be at least 1';
    return '';
  };

  const handleSave = () => {
    const err = validate();
    if (err) { setError(err); return; }

    // Use default score if same points mode
    const finalScore = isSamePoints ? (config?.defaultPoints ?? 10) : score;

    const problem: ProblemInput = {
      title: title.trim(),
      description: description.trim(),
      options: options
        .map((o, i) => ({ id: i as AllowedSubmissions, title: o.trim() }))
        .filter((o) => o.title),
      answer: correctAnswer,
      score: finalScore,
    };
    onSave(problem);
  };

  const updateOption = (idx: number, value: string) => {
    const next = [...options];
    next[idx] = value;
    setOptions(next);
    setError('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initial?.title ? 'Edit Question' : 'Add Question'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-1">
          <Label>Question Title</Label>
          <Input
            placeholder="e.g. What is the time complexity of binary search?"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(''); }}
          />
        </div>

        <div className="space-y-1">
          <Label>Description / Context</Label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px] resize-y"
            placeholder="Additional context, code snippet, or details..."
            value={description}
            onChange={(e) => { setDescription(e.target.value); setError(''); }}
          />
        </div>

        <div className="space-y-2">
          <Label>Answer Options</Label>
          <p className="text-xs text-muted-foreground">Fill in options and mark the correct one.</p>
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold cursor-pointer transition-colors
                  ${correctAnswer === idx
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-green-100'}`}
                title="Mark as correct"
                onClick={() => setCorrectAnswer(idx as AllowedSubmissions)}
              >
                {String.fromCharCode(65 + idx)}
              </div>
              <Input
                placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
                className={correctAnswer === idx && opt.trim() ? 'border-green-500 bg-green-50' : ''}
              />
              {correctAnswer === idx && (
                <span className="text-xs text-green-600 whitespace-nowrap font-medium">✓ Correct</span>
              )}
            </div>
          ))}
        </div>

        {isSamePoints ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-800">
              <strong>Points:</strong> {config?.defaultPoints ?? 10} (same for all questions)
            </p>
            <p className="text-xs text-blue-700 mt-1">
              All questions in this quiz have the same point value as configured during quiz creation.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <Label>Points for this question</Label>
              <Input
                type="number"
                className="w-28"
                min={1}
                max={1000}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-5">
              Players earn these points for a correct answer. Ranking uses points + time as tiebreaker.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave}>{saveLabel}</Button>
        </div>
      </CardContent>
    </Card>
  );
};
import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ProblemForm } from './ProblemForm';
import { useSocket } from '../../contexts/useSocket';
import type { Problem, ProblemInput } from '../../types/types';

interface Props {
  roomId: string;
  onNext: () => void;
  onBack: () => void;
}

type Mode = 'list' | 'add' | 'edit' | 'import';

export const AddQuestions = ({ roomId, onNext, onBack }: Props) => {
  const { admin } = useSocket();
  const { problems, addProblem, updateProblem, deleteProblem, reorderProblems } = admin;

  const [mode, setMode] = useState<Mode>('list');
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [importError, setImportError] = useState('');

  const handleAdd = (input: ProblemInput) => {
    addProblem(input);
    setMode('list');
  };

  const handleEdit = (input: ProblemInput) => {
    if (!editingProblem) return;
    updateProblem(editingProblem.id, input);
    setEditingProblem(null);
    setMode('list');
  };

  const handleDelete = (problemId: string) => {
    if (!window.confirm('Delete this question?')) return;
    deleteProblem(problemId);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const ids = problems.map((p) => p.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    reorderProblems(ids);
  };

  const moveDown = (idx: number) => {
    if (idx === problems.length - 1) return;
    const ids = problems.map((p) => p.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    reorderProblems(ids);
  };

  const handleImport = () => {
    try {
      setImportError('');
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) throw new Error('JSON must be an array');

      const validated: ProblemInput[] = parsed.map((q, i) => {
        if (!q.title) throw new Error(`Q${i + 1}: missing title`);
        if (!q.description) throw new Error(`Q${i + 1}: missing description`);
        if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(`Q${i + 1}: need ≥2 options`);
        if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.options.length)
          throw new Error(`Q${i + 1}: invalid answer index`);
        return {
          title: String(q.title).trim(),
          description: String(q.description).trim(),
          options: q.options.map((o: string, idx: number) => ({ id: idx, title: String(o).trim() })),
          answer: q.answer,
          score: typeof q.score === 'number' ? q.score : 10,
        };
      });

      admin.importProblems(validated);
      setJsonInput('');
      setMode('list');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  if (mode === 'add') {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setMode('list')}>← Back</Button>
          <h2 className="text-xl font-bold">Add Question</h2>
        </div>
        <ProblemForm onSave={handleAdd} onCancel={() => setMode('list')} saveLabel="Add Question" />
      </div>
    );
  }

  if (mode === 'edit' && editingProblem) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setMode('list'); setEditingProblem(null); }}>← Back</Button>
          <h2 className="text-xl font-bold">Edit Question</h2>
        </div>
        <ProblemForm
          initial={editingProblem}
          onSave={handleEdit}
          onCancel={() => { setMode('list'); setEditingProblem(null); }}
          saveLabel="Save Changes"
        />
      </div>
    );
  }

  if (mode === 'import') {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setMode('list')}>← Back</Button>
          <h2 className="text-xl font-bold">Import from JSON</h2>
        </div>
        <Card>
          <CardContent className="space-y-4 pt-4">
            {importError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{importError}</div>
            )}
            <textarea
              className="w-full h-64 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={`[\n  {\n    "title": "What is 2+2?",\n    "description": "Basic math",\n    "options": ["3", "4", "5", "6"],\n    "answer": 1,\n    "score": 10\n  }\n]`}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setMode('list')}>Cancel</Button>
              <Button onClick={handleImport} disabled={!jsonInput.trim()}>Import Questions</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // List mode
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
          <div>
            <h2 className="text-xl font-bold">Questions — {roomId}</h2>
            <p className="text-muted-foreground text-sm">{problems.length} question{problems.length !== 1 ? 's' : ''} added</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMode('import')}>Import JSON</Button>
          <Button size="sm" onClick={() => setMode('add')}>+ Add Question</Button>
        </div>
      </div>

      {problems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No questions yet.</p>
            <Button className="mt-4" onClick={() => setMode('add')}>Add first question</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {problems.map((p, idx) => (
            <Card key={p.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3 px-4 flex items-start gap-3">
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveUp(idx)} disabled={idx === 0}>▲</Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveDown(idx)} disabled={idx === problems.length - 1}>▼</Button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">Q{idx + 1}</span>
                    <span className="font-medium truncate">{p.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{p.description}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {p.options.map((o, oi) => (
                      <Badge
                        key={oi}
                        variant={p.answer === o.id ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {p.answer === o.id ? '✓ ' : ''}{o.title}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="outline">{p.score} pts</Badge>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingProblem(p); setMode('edit'); }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(p.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={problems.length === 0}>
          Preview Quiz →
        </Button>
      </div>
    </div>
  );
};
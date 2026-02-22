import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { useSocket } from '../contexts/useSocket';
import { QuizList } from './admin/QuizList';
import { CreateQuiz } from './admin/CreateQuiz';
import { AddQuestions } from './admin/AddQuestions';
import { PreviewQuiz } from './admin/PreviewQuestion';
import { LaunchQuiz } from './admin/LaunchQuiz';

type AdminStep = 'quiz-list' | 'create-quiz' | 'add-questions' | 'preview' | 'launch';

export const Admin = () => {
  const { isConnected, admin } = useSocket();
  const { isAuthenticated, login } = admin;

  const [step, setStep] = useState<AdminStep>('quiz-list');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const handleLogin = () => {
    if (!password.trim()) { setAuthError('Password required'); return; }
    setAuthError('');
    login(password.trim());
    setTimeout(() => {
      if (!admin.isAuthenticated) setAuthError('Invalid password');
    }, 1000);
  };

  /** Selecting an existing quiz from the list */
  const handleSelectQuiz = (roomId: string) => {
    admin.selectRoom(roomId);
    setActiveRoomId(roomId);
    // Check quiz status - if ended, go to launch (which shows leaderboard), otherwise add questions
    const quiz = admin.quizSummaries.find((q) => q.roomId === roomId);
    if (quiz?.status === 'ended') {
      setStep('launch');
    } else {
      setStep('add-questions');
    }
  };

  /**
   * Called after CreateQuiz completes.
   * CreateQuiz already called admin.selectRoom internally — don't call it again.
   */
  const handleQuizCreated = (roomId: string) => {
    setActiveRoomId(roomId);
    setStep('add-questions');
  };

  // ── Auth screen ────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 flex items-center justify-center p-3 sm:p-4">
        <Card className="w-full max-w-md border-2 border-blue-200 shadow-xl bg-white">
          <CardHeader className="text-center pb-3 sm:pb-4 bg-blue-600 text-white rounded-t-lg px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl font-bold text-white">Sign In</CardTitle>
            <CardDescription className="text-blue-100 mt-1 text-xs sm:text-sm">Welcome back you've been missed</CardDescription>
            <div className="flex items-center justify-center gap-2 mt-2 sm:mt-3">
              <div className={`h-2 sm:h-2.5 w-2 sm:w-2.5 rounded-full ${isConnected ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-red-400'}`} />
              <span className="text-xs text-blue-100 font-medium">{isConnected ? 'Connected' : 'Connecting…'}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 px-4 sm:px-6">
            {authError && (
              <div className="rounded-lg border-2 border-red-300 bg-red-50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-red-800 font-medium shadow-sm">{authError}</div>
            )}
            <div className="space-y-2">
              <Label className="text-black font-medium text-sm sm:text-base">Password</Label>
              <Input
                type="password"
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="border-blue-300 focus:border-blue-600 focus:ring-blue-600 text-sm sm:text-base"
              />
            </div>
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md text-sm sm:text-base" 
              onClick={handleLogin} 
              disabled={!isConnected}
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main admin UI ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 p-3 sm:p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6 p-3 sm:p-4 bg-white rounded-xl shadow-md border-2 border-blue-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-700">
              Quiz Admin
            </h1>
            <p className="text-blue-800 text-xs sm:text-sm mt-1">Manage quiz rooms and questions</p>
          </div>
          <Badge 
            variant={isConnected ? 'default' : 'destructive'}
            className={`text-xs sm:text-sm ${isConnected ? 'bg-blue-600 text-white shadow-md' : ''}`}
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {step !== 'quiz-list' && (
          <StepBreadcrumb
            step={step}
            roomId={activeRoomId}
            onStepClick={(s) => {
              const order: AdminStep[] = ['quiz-list', 'create-quiz', 'add-questions', 'preview', 'launch'];
              if (order.indexOf(s) <= order.indexOf(step)) setStep(s);
            }}
          />
        )}

        <div className="mt-4">
          {step === 'quiz-list' && (
            <QuizList onCreateNew={() => setStep('create-quiz')} onSelectQuiz={handleSelectQuiz} />
          )}
          {step === 'create-quiz' && (
            <CreateQuiz onCreated={handleQuizCreated} onBack={() => setStep('quiz-list')} />
          )}
          {step === 'add-questions' && activeRoomId && (
            <AddQuestions
              roomId={activeRoomId}
              onNext={() => setStep('preview')}
              onBack={() => setStep('quiz-list')}
            />
          )}
          {step === 'preview' && activeRoomId && (
            <PreviewQuiz
              roomId={activeRoomId}
              onNext={() => setStep('launch')}
              onBack={() => setStep('add-questions')}
            />
          )}
          {step === 'launch' && activeRoomId && (
            <LaunchQuiz roomId={activeRoomId} onBack={() => setStep('preview')} />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Breadcrumb ────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<AdminStep, string> = {
  'quiz-list':     'Quizzes',
  'create-quiz':   'Create',
  'add-questions': 'Questions',
  'preview':       'Preview',
  'launch':        'Launch',
};
const STEP_ORDER: AdminStep[] = ['quiz-list', 'create-quiz', 'add-questions', 'preview', 'launch'];

const StepBreadcrumb = ({
  step, roomId, onStepClick,
}: {
  step: AdminStep;
  roomId: string | null;
  onStepClick: (s: AdminStep) => void;
}) => {
  const currentIdx = STEP_ORDER.indexOf(step);
  const visibleSteps = step === 'create-quiz'
    ? STEP_ORDER.slice(0, 2)
    : STEP_ORDER.filter((s) => s !== 'create-quiz');

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      {visibleSteps.map((s, idx) => {
        const sIdx = STEP_ORDER.indexOf(s);
        const isCurrent = s === step;
        const isPast = sIdx < currentIdx;
        return (
          <span key={s} className="flex items-center gap-1">
            {idx > 0 && <span className="text-muted-foreground/50">/</span>}
            <button
              className={`px-2 py-1 rounded transition-colors ${
                isCurrent ? 'font-semibold text-foreground'
                : isPast   ? 'text-primary hover:underline cursor-pointer'
                           : 'text-muted-foreground/50 cursor-not-allowed'
              }`}
              onClick={() => (isPast || isCurrent) && onStepClick(s)}
              disabled={!isPast && !isCurrent}
            >
              {STEP_LABELS[s]}
            </button>
          </span>
        );
      })}
      {roomId && (
        <span className="ml-1 text-xs bg-muted px-2 py-0.5 rounded font-mono">{roomId}</span>
      )}
    </nav>
  );
};
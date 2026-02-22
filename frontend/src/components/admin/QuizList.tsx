import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useSocket } from '../../contexts/useSocket';
import type { QuizSummary } from '../../types/types';

interface Props {
  onCreateNew: () => void;
  onSelectQuiz: (roomId: string) => void;
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  not_started: 'secondary',
  scheduled: 'outline',
  question: 'default',
  leaderboard: 'default',
  ended: 'destructive',
};

const statusLabels: Record<string, string> = {
  not_started: 'Not Started',
  scheduled: 'Scheduled',
  question: 'Live',
  leaderboard: 'Leaderboard',
  ended: 'Ended',
};

export const QuizList = ({ onCreateNew, onSelectQuiz }: Props) => {
  const { admin } = useSocket();
  const { quizSummaries } = admin;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-black">Quiz Rooms</h2>
          <p className="text-blue-800 text-xs sm:text-sm">Manage your quizzes</p>
        </div>
        <Button onClick={onCreateNew} className="w-full sm:w-auto text-sm sm:text-base">+ Create New Quiz</Button>
      </div>

      {quizSummaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No quizzes yet.</p>
            <Button className="mt-4" onClick={onCreateNew}>Create your first quiz</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {quizSummaries.map((quiz) => (
            <QuizCard key={quiz.roomId} quiz={quiz} onSelect={() => onSelectQuiz(quiz.roomId)} />
          ))}
        </div>
      )}
    </div>
  );
};

const QuizCard = ({ quiz, onSelect }: { quiz: QuizSummary; onSelect: () => void }) => {
  const duration = !quiz.config
    ? 'Unknown'
    : quiz.config.durationType === 'per_question'
      ? `${quiz.config.durationPerQuestion}s / question`
      : quiz.config.durationType === 'total'
      ? `${quiz.config.totalDuration}s total`
      : 'No timer';

  return (
    <Card className="hover:shadow-md transition-shadow border-2 border-blue-200">
      <CardHeader className="pb-2 px-3 sm:px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base sm:text-lg text-black truncate">{quiz.roomId}</CardTitle>
            <CardDescription className="text-xs sm:text-sm text-blue-800">
              {quiz.problemCount} question{quiz.problemCount !== 1 ? 's' : ''} · {quiz.userCount} participant{quiz.userCount !== 1 ? 's' : ''} · {duration}
            </CardDescription>
          </div>
          <Badge variant={statusColors[quiz.status] || 'secondary'} className="text-xs sm:text-sm shrink-0">
            {statusLabels[quiz.status] || quiz.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <Button size="sm" onClick={onSelect} className="w-full sm:w-auto text-xs sm:text-sm bg-blue-600 hover:bg-blue-700">
          Manage →
        </Button>
      </CardContent>
    </Card>
  );
};
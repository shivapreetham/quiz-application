import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useSocket } from '../../contexts/useSocket';

interface Props {
  roomId: string;
  onNext: () => void;
  onBack: () => void;
}

export const PreviewQuiz = ({ roomId, onNext, onBack }: Props) => {
  const { admin } = useSocket();
  const { problems } = admin;

  const totalScore = problems.reduce((sum, p) => sum + p.score, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>← Edit Questions</Button>
          <div>
            <h2 className="text-xl font-bold">Preview — {roomId}</h2>
            <p className="text-muted-foreground text-sm">
              {problems.length} questions · {totalScore} total points
            </p>
          </div>
        </div>
        <Button onClick={onNext}>Launch Quiz →</Button>
      </div>

      <div className="space-y-4">
        {problems.map((p, idx) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">QUESTION {idx + 1}</p>
                  <CardTitle className="text-base mt-1">{p.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                </div>
                <Badge variant="outline" className="shrink-0 ml-3">{p.score} pts</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {p.options.map((o, oi) => (
                  <div
                    key={oi}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm
                      ${p.answer === o.id
                        ? 'border-green-500 bg-green-50 text-green-800 font-medium'
                        : 'border-border bg-muted/30'}`}
                  >
                    <span className="font-bold">{String.fromCharCode(65 + oi)}.</span>
                    {o.title}
                    {p.answer === o.id && <span className="ml-auto text-green-600">✓</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onNext}>Launch Quiz →</Button>
      </div>
    </div>
  );
};
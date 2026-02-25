import { Card, CardContent, CardHeader } from './ui/card';
import { Skeleton } from './ui/skeleton';

export function QuizLoadingSkeleton() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <Card className="max-w-3xl w-full">
        <CardHeader className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-6 w-full" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminLoadingSkeleton() {
  return (
    <div className="min-h-screen w-full p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ConnectionLoader() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-secondary/10 to-background">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
      <p className="mt-6 text-lg font-medium text-muted-foreground animate-pulse">
        Connecting to server...
      </p>
    </div>
  );
}

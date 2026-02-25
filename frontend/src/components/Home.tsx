import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useSocket } from '../contexts/useSocket';
import { ConnectionLoader } from './LoadingStates';

export const Home = () => {
  const [searchParams] = useSearchParams();
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState(() => searchParams.get('room') ?? '');
  const [isJoining, setIsJoining] = useState(false);
  const { joinRoom, isConnected, connectionError } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    if (roomId) {
      toast.info(`Room ID detected: ${roomId}`);
    }
  }, []);

  const handleJoin = async () => {
    const trimmedName = userName.trim();
    const trimmedRoom = roomId.trim();

    if (!trimmedName) {
      toast.error('Please enter your name');
      return;
    }
    if (!trimmedRoom) {
      toast.error('Please enter a room ID');
      return;
    }

    setIsJoining(true);
    try {
      joinRoom(trimmedRoom, trimmedName);
      navigate(`/quiz/${trimmedRoom}`);
    } catch (error) {
      toast.error('Failed to join quiz room');
      setIsJoining(false);
    }
  };

  if (!isConnected && !connectionError) {
    return <ConnectionLoader />;
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-secondary/10 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Quizzer
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Real-time Quiz Platform
          </p>
        </div>

        <Card className="shadow-2xl border-border/50 backdrop-blur-sm bg-card/95 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
          <CardHeader className="space-y-3 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl md:text-3xl font-bold text-center">
                Join Quiz
              </CardTitle>
              <CardDescription className="text-center text-sm md:text-base">
                Enter your details to participate
              </CardDescription>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <div
                className={`relative h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                  isConnected
                    ? 'bg-green-500 shadow-lg shadow-green-500/50 animate-pulse'
                    : 'bg-red-500 shadow-lg shadow-red-500/50'
                }`}
              >
                {isConnected && (
                  <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
                )}
              </div>
              <span className="text-xs md:text-sm font-medium text-muted-foreground">
                {isConnected ? 'Connected' : connectionError || 'Connecting...'}
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label htmlFor="userName" className="text-sm md:text-base font-medium">
                Your Name
              </Label>
              <Input
                id="userName"
                type="text"
                placeholder="Enter your full name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                disabled={!isConnected || isJoining}
                className="h-11 md:h-12 text-base transition-all duration-200 focus:scale-[1.01]"
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="roomId" className="text-sm md:text-base font-medium">
                Room ID
              </Label>
              <Input
                id="roomId"
                type="text"
                placeholder="Enter quiz room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                disabled={!isConnected || isJoining}
                className="h-11 md:h-12 text-base font-mono uppercase transition-all duration-200 focus:scale-[1.01]"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Get this from your instructor
              </p>
            </div>

            <Button
              onClick={handleJoin}
              disabled={!isConnected || isJoining || !userName.trim() || !roomId.trim()}
              className="w-full h-11 md:h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              size="lg"
            >
              {isJoining ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Joining...
                </span>
              ) : (
                'Join Quiz →'
              )}
            </Button>

            <div className="pt-4 border-t border-border/50">
              <p className="text-center text-xs md:text-sm text-muted-foreground">
                Are you an instructor?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="text-primary hover:underline font-medium transition-colors"
                >
                  Access Admin Panel
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground animate-in fade-in duration-1000 delay-300">
          Powered by Quizzer Platform
        </p>
      </div>
    </div>
  );
};
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useSocket } from '../contexts/useSocket';

export const Home = () => {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const { joinRoom, isConnected } = useSocket();
  const navigate = useNavigate();

  const handleJoin = () => {
    if (!userName.trim()) { setError('Please enter your name'); return; }
    if (!roomId.trim()) { setError('Please enter a room ID'); return; }
    joinRoom(roomId.trim(), userName.trim());
    navigate(`/quiz/${roomId.trim()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 flex items-center justify-center p-3 sm:p-4">
      <Card className="w-full max-w-md border-2 border-blue-200 shadow-xl bg-white">
        <CardHeader className="text-center pb-3 sm:pb-4 bg-white-600 text-black rounded-t-lg px-4 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl font-bold text-black">Quiz Portal - NITJSR</CardTitle>
          <CardDescription className="text-black-100 mt-1 text-xs sm:text-sm">Join a quiz session</CardDescription>
          <div className="flex items-center justify-center gap-2 mt-2 sm:mt-3">
            <div className={`h-2 sm:h-2.5 w-2 sm:w-2.5 rounded-full ${isConnected ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-red-400'}`} />
            <span className="text-xs text-black-100 font-medium">{isConnected ? 'Connected' : 'Connecting...'}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4 pt-4 sm:pt-6 px-4 sm:px-6">
          {error && (
            <div className="rounded-lg border-2 border-red-300 bg-red-50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-red-800 font-medium shadow-sm">{error}</div>
          )}
          <div className="space-y-2">
            <Label className="text-black font-medium text-sm sm:text-base">Enter your display name</Label>
            <Input
              placeholder="Enter Your Name"
              value={userName}
              onChange={(e) => { setUserName(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className="border-blue-300 focus:border-blue-600 focus:ring-blue-600 text-sm sm:text-base"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-black font-medium text-sm sm:text-base">Ask your instructor for the room ID</Label>
            <Input
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => { setRoomId(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className="border-blue-300 focus:border-blue-600 focus:ring-blue-600 text-sm sm:text-base"
            />
          </div>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md text-sm sm:text-base"
            onClick={handleJoin}
            disabled={!isConnected}
          >
            {isConnected ? 'Join Quiz' : 'Connecting...'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
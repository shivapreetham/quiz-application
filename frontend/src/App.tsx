import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { SocketProvider } from './contexts/SocketContext';
import { useSocket } from './contexts/useSocket';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './components/Home';
import { Quiz } from './components/Quiz';
import { Admin } from './components/Admin';
import { NotFound } from './components/NotFound';
import { Button } from './components/ui/button';
import './App.css';

function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { leaveRoom } = useSocket();

  const isQuizRoute = location.pathname.startsWith('/quiz');
  const isAdminRoute = location.pathname === '/admin';

  const handleGoHome = () => {
    if (isQuizRoute) {
      leaveRoom();
    }
    navigate('/');
  };

  if (!isQuizRoute && !isAdminRoute) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <Button
        variant="outline"
        onClick={handleGoHome}
        className="shadow-lg hover:shadow-xl transition-shadow"
        size="sm"
      >
        ← Home
      </Button>
    </div>
  );
}

function AppContent() {
  const { userId, currentRoomId } = useSocket();

  return (
    <>
      <Navigation />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route 
          path="/quiz/:roomId" 
          element={
            userId && currentRoomId ? (
              <Quiz />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <SocketProvider>
        <Router>
          <AppContent />
          <Toaster
            position="top-right"
            richColors
            closeButton
            expand={false}
            duration={4000}
          />
        </Router>
      </SocketProvider>
    </ErrorBoundary>
  );
}

export default App;

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import LandingPage from './components/LandingPage';
import BattleArena from './components/BattleArena';
import { Auth } from './components/Auth';
import { UserProfile } from './components/UserProfile';
import { useAuthStore } from './store/authStore';
import { User, LogIn } from 'lucide-react';

function AuthButtons() {
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { user, profile } = useAuthStore();
  const location = useLocation();

  // Hide auth buttons in battle arena
  if (location.pathname === '/battle') return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex gap-2">
      {user ? (
        <button
          onClick={() => setShowProfile(true)}
          className="bg-white/90 text-gray-800 px-4 py-2 rounded-lg shadow-lg hover:bg-white flex items-center gap-2"
        >
          <User className="w-5 h-5" />
          {profile?.username}
        </button>
      ) : (
        <button
          onClick={() => setShowAuth(true)}
          className="bg-white/90 text-gray-800 px-4 py-2 rounded-lg shadow-lg hover:bg-white flex items-center gap-2"
        >
          <LogIn className="w-5 h-5" />
          Sign In
        </button>
      )}

      <AnimatePresence>
        {showAuth && <Auth onClose={() => setShowAuth(false)} />}
        {showProfile && <UserProfile onClose={() => setShowProfile(false)} />}
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="relative">
        <AuthButtons />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/battle" element={<BattleArena />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
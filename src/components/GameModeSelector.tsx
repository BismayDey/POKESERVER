import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Users, ArrowRight, Globe } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

interface GameModeSelectorProps {
  onSelect: (mode: 'pvp' | 'ai' | 'online') => void;
}

export const GameModeSelector: React.FC<GameModeSelectorProps> = ({ onSelect }) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const handleOnlineSelect = () => {
    if (!user) {
      navigate('/');
      return;
    }
    onSelect('online');
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center z-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl max-w-3xl w-full mx-4"
      >
        <h2 className="text-4xl font-bold text-white text-center mb-8">Choose Your Battle Mode</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect('pvp')}
            className="bg-white/20 hover:bg-white/30 p-6 rounded-xl text-white transition-colors group"
          >
            <Users className="w-16 h-16 mx-auto mb-4 group-hover:text-yellow-300 transition-colors" />
            <h3 className="text-2xl font-bold mb-2">Local PvP</h3>
            <p className="text-white/80 mb-4">Battle against friends on the same device</p>
            <div className="flex items-center justify-center text-yellow-300 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="mr-2">Select</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect('ai')}
            className="bg-white/20 hover:bg-white/30 p-6 rounded-xl text-white transition-colors group"
          >
            <Bot className="w-16 h-16 mx-auto mb-4 group-hover:text-green-300 transition-colors" />
            <h3 className="text-2xl font-bold mb-2">VS AI</h3>
            <p className="text-white/80 mb-4">Challenge our strategic AI opponent</p>
            <div className="flex items-center justify-center text-green-300 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="mr-2">Select</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOnlineSelect}
            className={`bg-white/20 p-6 rounded-xl text-white transition-colors group relative ${
              user ? 'hover:bg-white/30' : 'cursor-not-allowed'
            }`}
          >
            <Globe className="w-16 h-16 mx-auto mb-4 group-hover:text-blue-300 transition-colors" />
            <h3 className="text-2xl font-bold mb-2">Online Battle</h3>
            <p className="text-white/80 mb-4">Fight trainers worldwide in real-time</p>
            {!user && (
              <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                <p className="text-white font-bold">Sign in required</p>
              </div>
            )}
            {user && (
              <div className="flex items-center justify-center text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="mr-2">Select</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
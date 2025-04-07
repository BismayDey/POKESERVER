import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, X, Timer, Sword, Shield, Wifi, WifiOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { socket } from '../socket';
import { toast } from 'react-toastify';

interface OnlineQueueProps {
  onMatchFound: (opponent: any) => void;
  onCancel: () => void;
}

export const OnlineQueue: React.FC<OnlineQueueProps> = ({ onMatchFound, onCancel }) => {
  const [queueTime, setQueueTime] = useState(0);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [playersInQueue, setPlayersInQueue] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const { profile } = useAuthStore();

  useEffect(() => {
    // Connect to socket server when component mounts
    socket.connect();

    // Connection status handlers
    socket.on('connect', () => {
      setIsConnected(true);
      toast.success('Connected to battle server!', {
        position: "top-center",
        autoClose: 2000
      });
      
      // Join queue after successful connection
      socket.emit('joinQueue', {
        userId: profile?.uid,
        username: profile?.username,
        rating: profile?.rating || 1000,
        stats: {
          wins: profile?.wins || 0,
          losses: profile?.losses || 0
        }
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      toast.error('Disconnected from battle server', {
        position: "top-center",
        autoClose: 2000
      });
    });

    // Queue status updates
    socket.on('queueUpdate', (data: { position: number; totalPlayers: number }) => {
      setQueuePosition(data.position);
      setPlayersInQueue(data.totalPlayers);
      
      // Show toast for queue updates
      toast.info(`Players in queue: ${data.totalPlayers}`, {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: true
      });
    });

    socket.on('matchFound', (data) => {
      toast.success(`Match found with ${data.opponent.username}!`, {
        position: "top-center",
        autoClose: 3000
      });
      onMatchFound(data);
    });

    // Start queue timer
    const timer = setInterval(() => {
      setQueueTime(prev => prev + 1);
    }, 1000);

    // Cleanup
    return () => {
      clearInterval(timer);
      socket.emit('leaveQueue');
      socket.disconnect();
      socket.off('connect');
      socket.off('disconnect');
      socket.off('queueUpdate');
      socket.off('matchFound');
    };
  }, []);

  const handleCancel = () => {
    socket.emit('leaveQueue');
    socket.disconnect();
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEstimatedTime = () => {
    if (playersInQueue <= 1) return '~1-2 minutes';
    if (playersInQueue <= 3) return '~30 seconds';
    return 'Very soon!';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center relative overflow-hidden"
      >
        {/* Connection Status Bar */}
        <div 
          className={`absolute top-0 left-0 right-0 p-2 flex items-center justify-center gap-2 text-sm
            ${isConnected ? 'bg-green-500' : 'bg-red-500'} text-white`}
        >
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4" />
              Connected to battle server
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              Connecting to battle server...
            </>
          )}
        </div>

        <div className="mt-6">
          <button
            onClick={handleCancel}
            className="absolute right-4 top-14 text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex justify-center mb-6">
            <div className="relative">
              <motion.div 
                className="flex items-center gap-4"
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Sword className="w-12 h-12 text-blue-500" />
                <Shield className="w-12 h-12 text-red-500" />
              </motion.div>
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                Matchmaking...
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-4">Finding Opponent</h2>
          
          <div className="flex items-center justify-center gap-2 text-gray-600 mb-6">
            <Timer className="w-5 h-5" />
            <span>{formatTime(queueTime)}</span>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-6 space-y-2">
            <div className="flex items-center justify-center gap-2 text-gray-700">
              <Users className="w-5 h-5" />
              <span className="font-medium">
                {playersInQueue} {playersInQueue === 1 ? 'trainer' : 'trainers'} in queue
              </span>
            </div>
            {queuePosition !== null && (
              <p className="text-sm text-gray-600">
                Your position: #{queuePosition}
              </p>
            )}
            <p className="text-sm text-gray-600">
              Estimated wait time: {getEstimatedTime()}
            </p>
            <p className="text-sm text-gray-600">
              {profile?.username}, we're matching you with a trainer of similar skill...
            </p>
          </div>

          {/* Loading Animation */}
          <div className="flex justify-center gap-4">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 360, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear",
                  delay: i * 0.3
                }}
                className={`w-3 h-3 rounded-full ${
                  i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-red-500' : 'bg-yellow-500'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleCancel}
            className="mt-6 bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Cancel Search
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
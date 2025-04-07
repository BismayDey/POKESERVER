import React from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { Trophy, X, Swords, Shield, Star, History, Flame } from 'lucide-react';

interface UserProfileProps {
  onClose: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onClose }) => {
  const { profile, signOut } = useAuthStore();

  if (!profile) return null;

  const winRate = profile.totalBattles > 0 
    ? ((profile.wins / profile.totalBattles) * 100).toFixed(1) 
    : '0.0';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-xl p-8 max-w-md w-full mx-4 relative max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-700"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold mb-2">{profile.username}</h2>
          <p className="text-gray-600">{profile.email}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <Trophy className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Wins</p>
            <p className="text-2xl font-bold text-green-600">{profile.wins}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg text-center">
            <Shield className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Losses</p>
            <p className="text-2xl font-bold text-red-600">{profile.losses}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <Star className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Win Rate</p>
            <p className="text-2xl font-bold text-blue-600">{winRate}%</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg text-center">
            <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Win Streak</p>
            <p className="text-2xl font-bold text-orange-600">{profile.winStreak}</p>
            <p className="text-xs text-gray-500">Best: {profile.highestWinStreak}</p>
          </div>
        </div>

        {profile.favoritePokemons.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-4">Favorite Pokemon</h3>
            <div className="flex flex-wrap gap-2">
              {profile.favoritePokemons.map((pokemon, index) => (
                <span
                  key={index}
                  className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm"
                >
                  {pokemon}
                </span>
              ))}
            </div>
          </div>
        )}

        {Object.entries(profile.pokemonHealth).length > 0 && (
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-4">Active Pokemon</h3>
            <div className="space-y-2">
              {Object.entries(profile.pokemonHealth).map(([id, health]) => (
                <div key={id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Swords className="w-5 h-5 text-blue-500" />
                    <span className="font-medium">Pokemon #{id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${(health / 100) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{health}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.battleHistory.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <History className="w-5 h-5" />
              Recent Battles
            </h3>
            <div className="space-y-2">
              {profile.battleHistory.slice(-5).reverse().map((battle, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    battle.result === 'win' ? 'bg-green-50' : 'bg-red-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{battle.pokemon}</p>
                      <p className="text-sm text-gray-600">vs {battle.opponent}</p>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        battle.result === 'win' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {battle.result.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(battle.date).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={signOut}
          className="w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors"
        >
          Sign Out
        </button>
      </motion.div>
    </motion.div>
  );
};
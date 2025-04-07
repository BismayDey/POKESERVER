import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Trophy, Users, Gamepad2, Star, Zap } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 to-yellow-400">
      {/* Hero Section */}
      <div className="relative h-screen flex items-center">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?auto=format&fit=crop&q=80&w=1920"
            alt="Pokemon background"
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center">
            <h1 className="text-7xl font-bold text-white mb-8 drop-shadow-lg">
              Pokémon Battle Arena
            </h1>
            <p className="text-2xl text-white mb-12 max-w-2xl mx-auto">
              Step into the arena and prove your worth as a Pokémon trainer in intense real-time battles!
            </p>
            
            <button
              onClick={() => navigate('/battle')}
              className="bg-white text-red-500 px-12 py-6 rounded-full text-2xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
            >
              Enter Battle Arena
            </button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white/95 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16">Battle Features</h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-8 rounded-xl text-center transform hover:scale-105 transition-all">
              <Gamepad2 className="w-16 h-16 mx-auto mb-6 text-red-500" />
              <h3 className="text-2xl font-bold mb-4">Strategic Battles</h3>
              <p className="text-gray-700">Use your Pokémon's unique stats and abilities to outsmart your opponents</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-xl text-center transform hover:scale-105 transition-all">
              <Star className="w-16 h-16 mx-auto mb-6 text-blue-500" />
              <h3 className="text-2xl font-bold mb-4">Original Pokémon</h3>
              <p className="text-gray-700">Choose from the classic 151 Pokémon, each with their authentic stats and moves</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-8 rounded-xl text-center transform hover:scale-105 transition-all">
              <Zap className="w-16 h-16 mx-auto mb-6 text-purple-500" />
              <h3 className="text-2xl font-bold mb-4">Real-time Action</h3>
              <p className="text-gray-700">Experience battles with dynamic animations and instant feedback</p>
            </div>
          </div>
        </div>
      </div>

      {/* How to Play Section */}
      <div className="py-20 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16">How to Play</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
              <h3 className="text-2xl font-bold mb-4">1. Choose Players</h3>
              <p>Select your trainer and prepare for battle</p>
            </div>

            <div className="text-center">
              <Swords className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
              <h3 className="text-2xl font-bold mb-4">2. Select Pokémon</h3>
              <p>Pick your Pokémon and analyze their stats</p>
            </div>

            <div className="text-center">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
              <h3 className="text-2xl font-bold mb-4">3. Battle!</h3>
              <p>Use strategy and timing to defeat your opponent</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
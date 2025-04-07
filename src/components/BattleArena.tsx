import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBattleStore } from '../store/battleStore';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { Pokemon } from '../types/pokemon';
import { Shield, Swords, Zap, Heart, Bot, Users, MessageSquare, X, Trophy, Skull, Globe } from 'lucide-react';
import { LoadingAnimation } from './LoadingAnimation';
import { GameModeSelector } from './GameModeSelector';
import { TypeAdvantageChart } from './TypeAdvantageChart';
import { OnlineQueue } from './OnlineQueue';
import { socket } from '../socket';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Confetti from 'react-confetti';

export default function BattleArena() {
  const [pokemonList, setPokemonList] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModeSelector, setShowModeSelector] = useState(true);
  const [showRoundSelector, setShowRoundSelector] = useState(false);
  const [showTypeChart, setShowTypeChart] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const battle = useBattleStore();
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPokemon = async () => {
      try {
        const responses = await Promise.all(
          Array.from({ length: 6 }, () =>
            fetch(`https://pokeapi.co/api/v2/pokemon/${Math.floor(Math.random() * 151) + 1}`)
          )
        );
        const pokemon = await Promise.all(responses.map(res => res.json()));
        setPokemonList(pokemon);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching Pokemon:', error);
        setLoading(false);
      }
    };

    fetchPokemon();

    // Set up socket listeners for online mode
    socket.on('matchFound', (data) => {
      toast.success(`Match found! Playing against ${data.opponent.username}`, {
        position: "top-center",
        autoClose: 3000
      });
      battle.setOnlineOpponent(data);
    });

    socket.on('opponentLeft', () => {
      toast.error('Opponent has left the battle!', {
        position: "top-center",
        autoClose: 5000
      });
      battle.resetBattle();
      setShowModeSelector(true);
    });

    socket.on('pokemonSelected', (data) => {
      const { player, pokemonId, hp } = data;
      const pokemon = pokemonList.find(p => p.id === pokemonId);
      if (pokemon) {
        battle.setPokemon(player, pokemon);
        toast.info(`${data.username} selected ${pokemon.name}!`, {
          position: "top-center",
          autoClose: 2000
        });
      }
    });

    socket.on('attackPerformed', (data) => {
      battle.attack(data.attacker);
    });

    return () => {
      socket.off('matchFound');
      socket.off('opponentLeft');
      socket.off('pokemonSelected');
      socket.off('attackPerformed');
    };
  }, []);

  useEffect(() => {
    if (battle.winner) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }
  }, [battle.winner]);

  // AI logic for selecting Pokemon and attacking
  useEffect(() => {
    if (battle.gameMode === 'ai' && battle.currentTurn === 'player2' && !battle.winner) {
      const aiTurn = async () => {
        // AI Pokemon selection
        if (!battle.player2.pokemon) {
          const availablePokemon = battle.player2.deck.filter(p => 
            !battle.player2.defeatedPokemon.includes(p.id)
          );
          
          if (availablePokemon.length > 0) {
            // Strategic Pokemon selection based on type advantage
            const player1Pokemon = battle.player1.pokemon;
            let bestPokemon = availablePokemon[0];
            let bestScore = -1;

            for (const pokemon of availablePokemon) {
              let score = 0;
              
              if (player1Pokemon) {
                // Calculate type effectiveness
                pokemon.types.forEach(type => {
                  player1Pokemon.types.forEach(enemyType => {
                    if (isTypeEffectiveAgainst(type.type.name, enemyType.type.name)) {
                      score += 2;
                    }
                  });
                });

                // Consider stats
                const pokemonStats = calculateTotalStats(pokemon);
                const enemyStats = calculateTotalStats(player1Pokemon);
                
                if (pokemonStats.attack > enemyStats.defense) score += 1;
                if (pokemonStats.defense > enemyStats.attack) score += 1;
                if (pokemonStats.speed > enemyStats.speed) score += 1;
              }

              // Add some randomness
              score += Math.random();

              if (score > bestScore) {
                bestScore = score;
                bestPokemon = pokemon;
              }
            }

            // Delay for more natural gameplay
            await new Promise(resolve => setTimeout(resolve, 1000));
            battle.setPokemon('player2', bestPokemon);
          }
        } else {
          // AI attack logic
          await new Promise(resolve => setTimeout(resolve, 1500));
          battle.attack('player2');
        }
      };

      aiTurn();
    }
  }, [battle.currentTurn, battle.gameMode, battle.player2.pokemon, battle.winner]);

  const handleGameModeSelect = async (mode: 'pvp' | 'ai' | 'online') => {
    try {
      setLoading(true);
      await battle.setGameMode(mode);
      setShowModeSelector(false);
      if (mode !== 'online') {
        setShowRoundSelector(true);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error setting game mode:', error);
      setLoading(false);
    }
  };

  const handleMatchFound = (opponent: any) => {
    setShowRoundSelector(true);
  };

  const handleQueueCancel = () => {
    battle.leaveQueue();
    setShowModeSelector(true);
  };

  // Helper functions for AI
  const isTypeEffectiveAgainst = (attackType: string, defenseType: string) => {
    const effectiveness: { [key: string]: string[] } = {
      fire: ['grass', 'ice', 'bug', 'steel'],
      water: ['fire', 'ground', 'rock'],
      electric: ['water', 'flying'],
      grass: ['water', 'ground', 'rock'],
      // Add more type effectiveness relationships
    };
    return effectiveness[attackType]?.includes(defenseType) || false;
  };

  const calculateTotalStats = (pokemon: Pokemon) => {
    return pokemon.stats.reduce((total, stat) => total + stat.base_stat, 0);
  };

  const handleRoundSelection = (rounds: number) => {
    battle.setTotalRounds(rounds);
    setShowRoundSelector(false);
  };

  const renderRoundSelector = () => {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
      >
        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full mx-4">
          <h2 className="text-3xl font-bold text-center mb-6">Select Number of Rounds</h2>
          <div className="grid grid-cols-3 gap-4">
            {[1, 3, 5].map((rounds) => (
              <motion.button
                key={rounds}
                onClick={() => handleRoundSelection(rounds)}
                className="bg-blue-500 text-white py-4 px-6 rounded-lg text-xl font-bold hover:bg-blue-600 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {rounds} {rounds === 1 ? 'Round' : 'Rounds'}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderStats = (player: 'player1' | 'player2') => {
    const stats = battle[player].stats;
    if (!stats) return null;

    return (
      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-500" />
          <span className="text-sm">HP: {stats.hp}</span>
        </div>
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-orange-500" />
          <span className="text-sm">ATK: {stats.attack}</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-500" />
          <span className="text-sm">DEF: {stats.defense}</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span className="text-sm">SPD: {stats.speed}</span>
        </div>
      </div>
    );
  };

  const renderPokemon = (player: 'player1' | 'player2') => {
    const { pokemon, hp } = battle[player];
    if (!pokemon) return null;

    const isDefeated = hp === 0;

    return (
      <motion.div 
        className={`text-center relative ${isDefeated ? 'grayscale' : ''}`}
        animate={{
          scale: battle.isAttacking && battle.currentTurn !== player ? 0.9 : 1,
          opacity: isDefeated ? 0.7 : 1,
        }}
        transition={{ type: "spring", stiffness: 200, damping: 10 }}
      >
        {isDefeated && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Skull className="w-16 h-16 text-red-500 animate-pulse" />
          </div>
        )}
        <motion.img
          src={player === 'player1' ? pokemon.sprites.back_default : pokemon.sprites.front_default}
          alt={pokemon.name}
          className={`w-32 h-32 md:w-48 md:h-48 mx-auto ${isDefeated ? 'opacity-50' : ''}`}
          animate={{
            x: battle.isAttacking && battle.currentTurn === player ? [0, -20, 20, 0] : 0,
            rotate: battle.isAttacking && battle.currentTurn === player ? [0, -5, 5, 0] : 0,
          }}
          transition={{ duration: 0.3 }}
        />
        <h3 className="text-lg md:text-xl font-bold capitalize">{pokemon.name}</h3>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {pokemon.types.map((type, index) => (
            <span
              key={index}
              className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm text-white capitalize ${getTypeColor(type.type.name)}`}
            >
              {type.type.name}
            </span>
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 md:h-4 mt-2">
          <motion.div
            className={`h-full rounded-full transition-all ${
              hp > 50 ? 'bg-green-500' : hp > 20 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            initial={{ width: '100%' }}
            animate={{ width: `${(hp / battle[player].stats!.hp) * 100}%` }}
            transition={{ type: "spring", stiffness: 100 }}
          />
        </div>
        <p className="mt-2 text-sm md:text-base">HP: {hp}/{battle[player].stats?.hp}</p>
        {renderStats(player)}
      </motion.div>
    );
  };

  const renderBattleLog = () => {
    return (
      <AnimatePresence>
        {battle.showBattleLog && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed right-0 top-0 h-full w-full md:w-80 bg-gray-800 text-white p-4 shadow-lg z-50"
          >
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-xl">Battle Log</h4>
              <button
                onClick={battle.toggleBattleLog}
                className="text-white hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-y-auto">
              {battle.battleLog.map((log, index) => (
                <motion.p
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm opacity-90 mb-2 p-2 bg-gray-700 rounded"
                >
                  {log}
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const getTypeColor = (type: string): string => {
    const colors: { [key: string]: string } = {
      normal: 'bg-gray-500',
      fire: 'bg-red-500',
      water: 'bg-blue-500',
      electric: 'bg-yellow-500',
      grass: 'bg-green-500',
      ice: 'bg-cyan-500',
      fighting: 'bg-red-700',
      poison: 'bg-purple-500',
      ground: 'bg-yellow-700',
      flying: 'bg-indigo-400',
      psychic: 'bg-pink-500',
      bug: 'bg-lime-500',
      rock: 'bg-yellow-800',
      ghost: 'bg-purple-700',
      dragon: 'bg-indigo-700',
      dark: 'bg-gray-800',
      steel: 'bg-gray-400',
      fairy: 'bg-pink-400',
    };
    return colors[type] || 'bg-gray-500';
  };

  if (loading || battle.isLoading) {
    return <LoadingAnimation />;
  }

  const isPokemonDefeated = (pokemon: Pokemon) => {
    return battle.player1.defeatedPokemon.includes(pokemon.id) || 
           battle.player2.defeatedPokemon.includes(pokemon.id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-4 md:p-8">
      {showConfetti && <Confetti />}
      <ToastContainer />
      
      <AnimatePresence>
        {showModeSelector && (
          <GameModeSelector onSelect={handleGameModeSelect} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {battle.inQueue && !battle.matchFound && (
          <OnlineQueue
            onMatchFound={handleMatchFound}
            onCancel={handleQueueCancel}
          />
        )}
      </AnimatePresence>

      {showRoundSelector && renderRoundSelector()}
      
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="bg-white/20 px-4 py-2 rounded-lg text-white text-center">
              Round {battle.currentRound} of {battle.totalRounds}
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => battle.setGameMode('pvp')}
                className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm md:text-base ${
                  battle.gameMode === 'pvp' ? 'bg-white text-blue-600' : 'bg-white/20 text-white'
                }`}
              >
                <Users className="w-4 h-4 md:w-5 md:h-5" />
                PvP Mode
              </button>
              <button
                onClick={() => battle.setGameMode('ai')}
                className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm md:text-base ${
                  battle.gameMode === 'ai' ? 'bg-white text-blue-600' : 'bg-white/20 text-white'
                }`}
              >
                <Bot className="w-4 h-4 md:w-5 md:h-5" />
                AI Mode
              </button>
              <button
                onClick={() => battle.setGameMode('online')}
                className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-lg text-sm md:text-base ${
                  battle.gameMode === 'online' ? 'bg-white text-blue-600' : 'bg-white/20 text-white'
                }`}
              >
                <Globe className="w-4 h-4 md:w-5 md:h-5" />
                Online Mode
              </button>
            </div>
          </div>
          <motion.button
            onClick={battle.toggleBattleLog}
            className="bg-white/20 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-white/30 text-sm md:text-base"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />
            Battle Log
          </motion.button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-8 mb-8">
          <div className="bg-white/90 p-4 md:p-6 rounded-xl shadow-lg">
            {renderPokemon('player1')}
          </div>
          <div className="bg-white/90 p-4 md:p-6 rounded-xl shadow-lg">
            {renderPokemon('player2')}
          </div>
        </div>

        <AnimatePresence>
          {battle.winner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white/90 p-6 md:p-8 rounded-xl shadow-lg text-center mb-8"
            >
              <Trophy className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-yellow-500" />
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                {battle.winner === 'player1' ? 'Player 1' : battle.gameMode === 'ai' ? 'AI' : 'Player 2'} Wins!
              </h2>
              <button
                onClick={battle.resetBattle}
                className="bg-blue-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-lg text-lg md:text-xl font-bold hover:bg-blue-600 transition-colors"
              >
                Play Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!battle.winner && (
          <>
            <div className="grid md:grid-cols-2 gap-4 md:gap-8">
              <div className="bg-white/90 p-4 md:p-6 rounded-xl shadow-lg">
                <h3 className="text-lg md:text-xl font-bold mb-4">Player 1 Selection</h3>
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                  {pokemonList.slice(0, 3).map((pokemon) => {
                    const isDefeated = isPokemonDefeated(pokemon);
                    return (
                      <motion.button
                        key={pokemon.id}
                        onClick={() => !isDefeated && battle.setPokemon('player1', pokemon)}
                        className={`relative p-2 md:p-4 rounded-lg transition-colors border-2 border-transparent
                          ${isDefeated ? 'bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-100 hover:border-blue-500'}`}
                        whileHover={!isDefeated ? { scale: 1.05 } : {}}
                        whileTap={!isDefeated ? { scale: 0.95 } : {}}
                      >
                        {isDefeated && (
                          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                            <Skull className="w-8 h-8 text-red-500" />
                          </div>
                        )}
                        <img
                          src={pokemon.sprites.front_default}
                          alt={pokemon.name}
                          className={`w-16 h-16 md:w-24 md:h-24 mx-auto ${isDefeated ? 'grayscale' : ''}`}
                        />
                        <p className="text-xs md:text-sm capitalize font-semibold">{pokemon.name}</p>
                        <div className="text-xs text-gray-600 mt-1">
                          HP: {pokemon.stats.find(s => s.stat.name === 'hp')?.base_stat}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {battle.gameMode === 'pvp' && (
                <div className="bg-white/90 p-4 md:p-6 rounded-xl shadow-lg">
                  <h3 className="text-lg md:text-xl font-bold mb-4">Player 2 Selection</h3>
                  <div className="grid grid-cols-3 gap-2 md:gap-4">
                    {pokemonList.slice(3, 6).map((pokemon) => {
                      const isDefeated = isPokemonDefeated(pokemon);
                      return (
                        <motion.button
                          key={pokemon.id}
                          onClick={() => !isDefeated && battle.setPokemon('player2', pokemon)}
                          className={`relative p-2 md:p-4 rounded-lg transition-colors border-2 border-transparent
                            ${isDefeated ? 'bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-100 hover:border-blue-500'}`}
                          whileHover={!isDefeated ? { scale: 1.05 } : {}}
                          whileTap={!isDefeated ? { scale: 0.95 } : {}}
                        >
                          {isDefeated && (
                            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                              <Skull className="w-8 h-8 text-red-500" />
                            </div>
                          )}
                          <img
                            src={pokemon.sprites.front_default}
                            alt={pokemon.name}
                            className={`w-16 h-16 md:w-24 md:h-24 mx-auto ${isDefeated ? 'grayscale' : ''}`}
                          />
                          <p className="text-xs md:text-sm capitalize font-semibold">{pokemon.name}</p>
                          <div className="text-xs text-gray-600 mt-1">
                            HP: {pokemon.stats.find(s => s.stat.name === 'hp')?.base_stat}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              {battle.gameMode === 'ai' && (
                <div className="bg-white/90 p-4 md:p-6 rounded-xl shadow-lg">
                  <h3 className="text-lg md:text-xl font-bold mb-4">AI Selection</h3>
                  <div className="grid grid-cols-3 gap-2 md:gap-4">
                    {battle.player2.deck.slice(0, 3).map((pokemon) => {
                      const isDefeated = isPokemonDefeated(pokemon);
                      return (
                        <div
                          key={pokemon.id}
                          className={`relative p-2 md:p-4 rounded-lg ${isDefeated ? 'bg-gray-100' : 'bg-gray-50'}`}
                        >
                          {isDefeated && (
                            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                              <Skull className="w-8 h-8 text-red-500" />
                            </div>
                          )}
                          <img
                            src={pokemon.sprites.front_default}
                            alt={pokemon.name}
                            className={`w-16 h-16 md:w-24 md:h-24 mx-auto ${isDefeated ? 'grayscale' : ''}`}
                          />
                          <p className="text-xs md:text-sm capitalize font-semibold">{pokemon.name}</p>
                          <div className="text-xs text-gray-600 mt-1">
                            HP: {pokemon.stats.find(s => s.stat.name === 'hp')?.base_stat}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {renderBattleLog()}

            <div className="mt-8 text-center">
              <motion.button
                onClick={() => battle.attack(battle.currentTurn)}
                disabled={!battle.player1.pokemon || !battle.player2.pokemon || (battle.gameMode === 'ai' && battle.currentTurn === 'player2')}
                className="bg-red-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-full text-lg md:text-xl font-bold disabled:opacity-50 hover:bg-red-600 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Attack! ({battle.currentTurn === 'player1' ? 'Player 1' : battle.gameMode === 'ai' ? 'AI' : 'Player 2'}'s turn)
              </motion.button>
              <motion.button
                onClick={battle.resetBattle}
                className="ml-4 bg-gray-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-full text-lg md:text-xl font-bold hover:bg-gray-600 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Reset Battle
              </motion.button>
            </div>
          </>
        )}
      </div>

      {battle.player1.pokemon && battle.player2.pokemon && (
        <div className="fixed bottom-4 right-4 flex gap-2">
          <motion.button
            onClick={() => setShowTypeChart(!showTypeChart)}
            className="bg-white/20 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-white/30"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Shield className="w-4 h-4" />
            Type Advantages
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {showTypeChart && (
          <TypeAdvantageChart
            pokemon1={battle.player1.pokemon}
            pokemon2={battle.player2.pokemon}
            onClose={() => setShowTypeChart(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
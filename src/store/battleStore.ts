import { create } from 'zustand';
import type { BattleState, Pokemon, PokemonStats } from '../types/pokemon';
import { typeEffectiveness } from '../types/pokemon';
import { useAuthStore } from './authStore';
import { socket } from '../socket';

interface PokemonBattleState {
  pokemon: Pokemon | null;
  currentHp: number;
  maxHp: number;
}

const initialPlayerScore = {
  roundsWon: 0,
  totalDamageDealt: 0,
  criticalHits: 0,
  superEffectiveHits: 0,
};

const initialState: BattleState = {
  player1: { 
    pokemon: null, 
    hp: 100, 
    stats: null, 
    isAI: false, 
    deck: [],
    score: { ...initialPlayerScore },
    defeatedPokemon: [],
    pokemonStates: new Map<number, PokemonBattleState>()
  },
  player2: { 
    pokemon: null, 
    hp: 100, 
    stats: null, 
    isAI: false, 
    deck: [],
    score: { ...initialPlayerScore },
    defeatedPokemon: [],
    pokemonStates: new Map<number, PokemonBattleState>()
  },
  currentTurn: 'player1',
  battleLog: [],
  isAttacking: false,
  gameMode: 'pvp',
  winner: null,
  showBattleLog: false,
  totalRounds: 3,
  currentRound: 1,
  isLoading: false,
  consecutiveHits: 0,
  comboMultiplier: 1,
  selectedPokemon: [],
  isOnline: false,
  onlineOpponent: null,
  inQueue: false,
  matchFound: false,
};

const updatePokemonHealth = async (pokemon: Pokemon | null, hp: number) => {
  if (!pokemon) return;
  const auth = useAuthStore.getState();
  if (auth.user) {
    await auth.updatePokemonHealth(pokemon.id.toString(), hp);
  }
};

export const useBattleStore = create<BattleStore>((set, get) => ({
  ...initialState,

  setTotalRounds: (rounds: number) => set({ totalRounds: rounds }),

  setPokemon: (player, pokemon) =>
    set((state) => {
      if (state.player1.defeatedPokemon.includes(pokemon.id) || 
          state.player2.defeatedPokemon.includes(pokemon.id)) {
        return state;
      }

      const playerState = state[player];
      const existingPokemonState = playerState.pokemonStates.get(pokemon.id);
      const stats = calculateStats(pokemon);
      const maxHp = stats.hp;

      const pokemonState: PokemonBattleState = existingPokemonState || {
        pokemon,
        currentHp: maxHp,
        maxHp
      };

      const newPokemonStates = new Map(playerState.pokemonStates);
      newPokemonStates.set(pokemon.id, pokemonState);

      const updates = {
        [player]: {
          ...playerState,
          pokemon,
          hp: pokemonState.currentHp,
          stats,
          pokemonStates: newPokemonStates
        },
        battleLog: [...state.battleLog, `${player === 'player1' ? 'Player 1' : 'Player 2'} chose ${pokemon.name}!`],
      };

      if (state.isOnline) {
        socket.emit('pokemonSelected', {
          player,
          pokemonId: pokemon.id,
          hp: pokemonState.currentHp
        });
      }

      return updates;
    }),

  attack: (attacker) => {
    const state = get();
    if (state.isOnline) {
      socket.emit('attack', {
        attacker,
        defender: attacker === 'player1' ? 'player2' : 'player1',
      });
    }

    return set((state) => {
      if (!state[attacker].pokemon || !state[attacker === 'player1' ? 'player2' : 'player1'].pokemon) {
        return state;
      }

      const defender = attacker === 'player1' ? 'player2' : 'player1';
      const attackerStats = state[attacker].stats!;
      const defenderStats = state[defender].stats!;
      const attackerPokemon = state[attacker].pokemon!;
      const defenderPokemon = state[defender].pokemon!;
      
      const typeMultiplier = calculateTypeEffectiveness(attackerPokemon, defenderPokemon);
      const speedAdvantage = attackerStats.speed > defenderStats.speed ? 1.2 : 1;
      const criticalHit = Math.random() < (0.1 + state.consecutiveHits * 0.02);
      
      const baseDamage = Math.max(1, Math.floor(
        (attackerStats.attack * speedAdvantage * (Math.random() * 0.4 + 0.8) - defenderStats.defense * 0.5) *
        state.comboMultiplier * (typeMultiplier > 1 ? 1.5 : 1)
      ));
      
      const damage = Math.floor(baseDamage * (criticalHit ? 1.5 : 1));
      const newHp = Math.max(0, state[defender].hp - damage);

      const defenderPokemonStates = new Map(state[defender].pokemonStates);
      const defenderPokemonState = defenderPokemonStates.get(defenderPokemon.id);
      if (defenderPokemonState) {
        defenderPokemonState.currentHp = newHp;
        defenderPokemonStates.set(defenderPokemon.id, defenderPokemonState);
      }
      
      const attackerScore = {
        ...state[attacker].score,
        totalDamageDealt: state[attacker].score.totalDamageDealt + damage,
        criticalHits: criticalHit ? state[attacker].score.criticalHits + 1 : state[attacker].score.criticalHits,
        superEffectiveHits: typeMultiplier > 1 ? state[attacker].score.superEffectiveHits + 1 : state[attacker].score.superEffectiveHits,
      };
      
      let effectivenessMessage = '';
      if (typeMultiplier > 1) {
        effectivenessMessage = "It's super effective!";
      } else if (typeMultiplier < 1) {
        effectivenessMessage = "It's not very effective...";
      }
      
      const log = [
        `${attacker === 'player1' ? 'Player 1' : 'Player 2'}'s ${attackerPokemon.name} dealt ${damage} damage!`,
        criticalHit ? "Critical hit!" : "",
        effectivenessMessage,
        state.consecutiveHits > 2 ? `${state.consecutiveHits + 1}x Combo!` : ""
      ].filter(Boolean);

      const newLog = [...state.battleLog, ...log];
      
      let winner = null;
      let roundWinner = null;
      let defeatedPokemon = [...state[defender].defeatedPokemon];

      if (newHp === 0) {
        roundWinner = attacker;
        attackerScore.roundsWon += 1;
        defeatedPokemon.push(state[defender].pokemon!.id);
        
        if (state.currentRound === state.totalRounds || attackerScore.roundsWon > state.totalRounds / 2) {
          winner = attacker;
          newLog.push(`${attackerPokemon.name} wins the battle! Game Over!`);

          const auth = useAuthStore.getState();
          if (auth.user) {
            auth.addBattleResult({
              opponent: state[defender].pokemon!.name,
              result: attacker === 'player1' ? 'win' : 'loss',
              pokemon: attackerPokemon.name
            });
          }
        } else {
          newLog.push(`${attackerPokemon.name} wins round ${state.currentRound}!`);
        }
      }

      updatePokemonHealth(state[defender].pokemon, newHp);

      return {
        ...state,
        [defender]: {
          ...state[defender],
          hp: newHp,
          defeatedPokemon,
          pokemonStates: defenderPokemonStates
        },
        [attacker]: {
          ...state[attacker],
          score: attackerScore,
        },
        currentTurn: defender,
        battleLog: newLog,
        isAttacking: true,
        winner,
        currentRound: roundWinner ? state.currentRound + 1 : state.currentRound,
        consecutiveHits: roundWinner ? 0 : state.consecutiveHits + 1,
        comboMultiplier: roundWinner ? 1 : Math.min(2, 1 + state.consecutiveHits * 0.1),
      };
    });
  },

  resetBattle: () => {
    const currentGameMode = get().gameMode;
    set({ 
      ...initialState,
      gameMode: currentGameMode,
      player2: {
        ...initialState.player2,
        isAI: currentGameMode === 'ai'
      }
    });
  },

  setGameMode: async (mode) => {
    set({ isLoading: true });
    
    try {
      if (mode === 'online') {
        if (socket.connected) {
          socket.disconnect();
        }
        
        socket.connect();
        
        set({
          ...initialState,
          gameMode: mode,
          isOnline: true,
          inQueue: true,
          isLoading: false,
        });
      } else if (mode === 'ai') {
        const responses = await Promise.all(
          Array.from({ length: 6 }, () =>
            fetch(`https://pokeapi.co/api/v2/pokemon/${Math.floor(Math.random() * 151) + 1}`)
          )
        );
        const aiDeck = await Promise.all(responses.map(res => res.json()));
        
        set({
          ...initialState,
          gameMode: mode,
          player2: {
            ...initialState.player2,
            isAI: true,
            deck: aiDeck,
          },
          isLoading: false,
        });
      } else {
        set({
          ...initialState,
          gameMode: mode,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Error setting game mode:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  toggleBattleLog: () => set((state) => ({ showBattleLog: !state.showBattleLog })),
  setOnlineOpponent: (opponent) => set({ onlineOpponent: opponent, matchFound: true, inQueue: false }),
  leaveQueue: () => {
    socket.disconnect();
    set({ inQueue: false, isOnline: false });
  },
}));

const calculateStats = (pokemon: Pokemon): PokemonStats => {
  const stats: PokemonStats = {
    hp: 0,
    attack: 0,
    defense: 0,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0,
  };

  pokemon.stats.forEach((stat) => {
    switch (stat.stat.name) {
      case 'hp':
        stats.hp = stat.base_stat;
        break;
      case 'attack':
        stats.attack = stat.base_stat;
        break;
      case 'defense':
        stats.defense = stat.base_stat;
        break;
      case 'special-attack':
        stats.specialAttack = stat.base_stat;
        break;
      case 'special-defense':
        stats.specialDefense = stat.base_stat;
        break;
      case 'speed':
        stats.speed = stat.base_stat;
        break;
    }
  });

  return stats;
};

const calculateTypeEffectiveness = (attacker: Pokemon, defender: Pokemon): number => {
  let multiplier = 1;
  
  attacker.types.forEach(attackerType => {
    defender.types.forEach(defenderType => {
      const effectiveness = typeEffectiveness[attackerType.type.name]?.[defenderType.type.name] || 1;
      multiplier *= effectiveness;
    });
  });
  
  return multiplier;
};
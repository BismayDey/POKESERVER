import React, { useEffect } from 'react';
import { useBattleStore } from '../store/battleStore';
import type { Pokemon } from '../types/pokemon';
import BattleArena from './BattleArena';

interface AIBattleLogicProps {
  playerPokemon: Pokemon | null;
  aiDeck: Pokemon[];
}

export const AIBattleLogic: React.FC<AIBattleLogicProps> = ({ playerPokemon, aiDeck }) => {
  const battle = useBattleStore();

  // AI Pokemon selection logic
  useEffect(() => {
    if (playerPokemon && battle.gameMode === 'ai' && !battle.player2.pokemon) {
      const selectAIPokemon = () => {
        const availablePokemon = aiDeck.filter(p => 
          !battle.selectedPokemon.includes(p.id) && 
          !battle.player2.defeatedPokemon.includes(p.id)
        );

        if (availablePokemon.length === 0) return;

        let bestPokemon = availablePokemon[0];
        let bestScore = -1;

        availablePokemon.forEach(pokemon => {
          let score = 0;

          // Type advantage analysis
          pokemon.types.forEach(aiType => {
            playerPokemon.types.forEach(playerType => {
              if (isTypeEffectiveAgainst(aiType.type.name, playerType.type.name)) {
                score += 15;
              }
              if (isTypeWeakAgainst(playerType.type.name, aiType.type.name)) {
                score += 10;
              }
            });
          });

          // Stat comparison
          const aiStats = calculateTotalStats(pokemon);
          const playerStats = calculateTotalStats(playerPokemon);

          if (aiStats.attack > playerStats.defense) score += 8;
          if (aiStats.defense > playerStats.attack) score += 6;
          if (aiStats.speed > playerStats.speed) score += 4;
          if (aiStats.hp > playerStats.hp) score += 4;

          // Add randomness to prevent predictability
          score += Math.random() * 15;

          if (score > bestScore) {
            bestScore = score;
            bestPokemon = pokemon;
          }
        });

        battle.setPokemon('player2', bestPokemon);
      };

      // Add a slight delay for dramatic effect
      setTimeout(selectAIPokemon, 1000);
    }
  }, [playerPokemon, battle.gameMode]);

  // AI battle turn logic
  useEffect(() => {
    if (battle.gameMode === 'ai' && battle.currentTurn === 'player2' && !battle.winner) {
      const makeAIMove = () => {
        if (battle.currentTurn === 'player2' && !battle.winner) {
          battle.attack('player2');
        }
      };

      // Add delay for more natural gameplay
      setTimeout(makeAIMove, 1500);
    }
  }, [battle.currentTurn, battle.gameMode, battle.winner]);

  return <BattleArena />;
};

// Helper functions
const calculateTotalStats = (pokemon: Pokemon) => {
  const stats = {
    hp: 0,
    attack: 0,
    defense: 0,
    speed: 0,
  };

  pokemon.stats.forEach(stat => {
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
      case 'speed':
        stats.speed = stat.base_stat;
        break;
    }
  });

  return stats;
};

const isTypeEffectiveAgainst = (attackType: string, defenseType: string): boolean => {
  const effectiveness: { [key: string]: string[] } = {
    fire: ['grass', 'ice', 'bug', 'steel'],
    water: ['fire', 'ground', 'rock'],
    electric: ['water', 'flying'],
    grass: ['water', 'ground', 'rock'],
    ice: ['grass', 'ground', 'flying', 'dragon'],
    fighting: ['normal', 'ice', 'rock', 'dark', 'steel'],
    poison: ['grass', 'fairy'],
    ground: ['fire', 'electric', 'poison', 'rock', 'steel'],
    flying: ['grass', 'fighting', 'bug'],
    psychic: ['fighting', 'poison'],
    bug: ['grass', 'psychic', 'dark'],
    rock: ['fire', 'ice', 'flying', 'bug'],
    ghost: ['psychic', 'ghost'],
    dragon: ['dragon'],
    dark: ['psychic', 'ghost'],
    steel: ['ice', 'rock', 'fairy'],
    fairy: ['fighting', 'dragon', 'dark']
  };

  return effectiveness[attackType]?.includes(defenseType) || false;
};

const isTypeWeakAgainst = (attackType: string, defenseType: string): boolean => {
  const weaknesses: { [key: string]: string[] } = {
    normal: ['rock', 'steel'],
    fire: ['fire', 'water', 'rock', 'dragon'],
    water: ['water', 'grass', 'dragon'],
    electric: ['electric', 'grass', 'dragon'],
    grass: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'],
    ice: ['fire', 'water', 'ice', 'steel'],
    fighting: ['poison', 'flying', 'psychic', 'bug', 'fairy'],
    poison: ['poison', 'ground', 'rock', 'ghost'],
    ground: ['grass', 'bug'],
    flying: ['electric', 'rock', 'steel'],
    psychic: ['psychic', 'steel'],
    bug: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'],
    rock: ['fighting', 'ground', 'steel'],
    ghost: ['dark'],
    dragon: ['steel'],
    dark: ['fighting', 'dark', 'fairy'],
    steel: ['fire', 'water', 'electric', 'steel'],
    fairy: ['fire', 'poison', 'steel']
  };

  return weaknesses[attackType]?.includes(defenseType) || false;
};
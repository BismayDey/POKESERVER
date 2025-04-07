import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, AlertTriangle, Shield, Swords, X } from 'lucide-react';
import type { Pokemon } from '../types/pokemon';
import { typeEffectiveness } from '../types/pokemon';

interface TypeAdvantageChartProps {
  pokemon1: Pokemon | null;
  pokemon2: Pokemon | null;
  onClose: () => void;
}

export const TypeAdvantageChart: React.FC<TypeAdvantageChartProps> = ({ pokemon1, pokemon2, onClose }) => {
  if (!pokemon1 || !pokemon2) return null;

  const calculateEffectiveness = (attacker: Pokemon, defender: Pokemon) => {
    let multiplier = 1;
    let relationships: { type: string; effectiveness: number }[] = [];

    attacker.types.forEach(attackerType => {
      defender.types.forEach(defenderType => {
        const effectiveness = typeEffectiveness[attackerType.type.name]?.[defenderType.type.name] || 1;
        relationships.push({
          type: defenderType.type.name,
          effectiveness: effectiveness
        });
        multiplier *= effectiveness;
      });
    });

    return {
      total: multiplier,
      relationships
    };
  };

  const player1Effectiveness = calculateEffectiveness(pokemon1, pokemon2);
  const player2Effectiveness = calculateEffectiveness(pokemon2, pokemon1);

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

  const renderEffectiveness = (effectiveness: number) => {
    if (effectiveness > 1) {
      return (
        <div className="flex items-center text-green-500">
          <Swords className="w-4 h-4 mr-1" />
          <span>Super effective (x{effectiveness})</span>
        </div>
      );
    } else if (effectiveness < 1) {
      return (
        <div className="flex items-center text-red-500">
          <Shield className="w-4 h-4 mr-1" />
          <span>Not very effective (x{effectiveness})</span>
        </div>
      );
    }
    return (
      <div className="flex items-center text-gray-500">
        <AlertTriangle className="w-4 h-4 mr-1" />
        <span>Normal effectiveness</span>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-0 top-0 h-full w-80 bg-white/95 shadow-lg p-6 overflow-y-auto z-50"
    >
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold">Type Matchup</h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-6">
        <div className="border-b pb-4">
          <h4 className="text-lg font-semibold mb-2 flex items-center">
            <img
              src={pokemon1.sprites.front_default}
              alt={pokemon1.name}
              className="w-8 h-8 mr-2"
            />
            {pokemon1.name} vs {pokemon2.name}
          </h4>
          <div className="space-y-2">
            {pokemon1.types.map((type, index) => (
              <div key={index} className="space-y-1">
                <div className={`inline-block px-2 py-1 rounded text-white text-sm ${getTypeColor(type.type.name)}`}>
                  {type.type.name}
                </div>
                {renderEffectiveness(player1Effectiveness.total)}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-lg font-semibold mb-2 flex items-center">
            <img
              src={pokemon2.sprites.front_default}
              alt={pokemon2.name}
              className="w-8 h-8 mr-2"
            />
            {pokemon2.name} vs {pokemon1.name}
          </h4>
          <div className="space-y-2">
            {pokemon2.types.map((type, index) => (
              <div key={index} className="space-y-1">
                <div className={`inline-block px-2 py-1 rounded text-white text-sm ${getTypeColor(type.type.name)}`}>
                  {type.type.name}
                </div>
                {renderEffectiveness(player2Effectiveness.total)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h5 className="font-semibold mb-2">Battle Tips</h5>
        <ul className="space-y-2 text-sm">
          {player1Effectiveness.total > 1 && (
            <li className="flex items-center text-green-600">
              <ChevronRight className="w-4 h-4 mr-1" />
              Your Pokémon has type advantage!
            </li>
          )}
          {player2Effectiveness.total > 1 && (
            <li className="flex items-center text-red-600">
              <ChevronRight className="w-4 h-4 mr-1" />
              Opponent has type advantage!
            </li>
          )}
          <li className="flex items-center text-blue-600">
            <ChevronRight className="w-4 h-4 mr-1" />
            Consider your moves carefully!
          </li>
        </ul>
      </div>
    </motion.div>
  );
};
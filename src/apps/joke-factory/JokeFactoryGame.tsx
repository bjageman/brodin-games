import { useEffect } from 'react';
import type { GamePlayProps } from '../../shared/GameShell';
import type { Envelope } from '../../shared/types';

export default function JokeFactoryGame({
  playerId,
  roster,
  onRegisterMessageHandler,
  onQuit,
}: GamePlayProps) {
  useEffect(() => {
    onRegisterMessageHandler((envelope: Envelope) => {
      // Stub for message handling
    });
  }, [onRegisterMessageHandler]);

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center text-white font-display">
      <h1 className="text-4xl font-extrabold tracking-wider text-yellow-400 mb-4 animate-bounce">
        🤡 JOKE FACTORY 🤡
      </h1>
      <p className="text-lg text-gray-300 max-w-md mb-8">
        Welcome to the Joke Factory! This game is currently under construction.
      </p>
      
      <div className="bg-white/10 border border-white/10 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-gray-200 mb-4">Players in Room ({roster.length}):</h3>
        <ul className="space-y-2">
          {roster.map((player) => (
            <li key={player.id} className={`text-sm text-gray-300 font-semibold bg-white/5 py-1.5 px-3 rounded-full ${player.id === playerId ? 'ring-2 ring-yellow-400' : ''}`}>
              {player.name} {player.id === playerId ? '(You)' : ''}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onQuit}
        className="mt-8 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-3 transition-transform hover:scale-105"
      >
        Quit Game
      </button>
    </div>
  );
}

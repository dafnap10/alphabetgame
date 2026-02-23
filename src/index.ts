// Main entry point for AlphabetGame
import { SoloMode } from './modes/SoloMode';
import { OnlineMode } from './modes/OnlineMode';
import { GameEngine } from './core/GameEngine';

export { GameEngine, SoloMode, OnlineMode };
export * from './types/game.types';
export { ScoringSystem } from './core/ScoringSystem';
export { RoundManager } from './core/RoundManager';
export { WebSocketClient } from './networking/WebSocketClient';
export { MatchmakingService } from './networking/MatchmakingService';

// Example usage
if (require.main === module) {
  const soloGame = new SoloMode('Player1');
  const gameSession = soloGame.startGame(5);
  console.log('Solo game started:', gameSession);

  const round = soloGame.getNextRound();
  console.log('First round letter:', round.letter);
  console.log('Categories:', round.categories);
}
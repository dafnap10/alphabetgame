import { GameEngine } from '../core/GameEngine';
import { Player, GameSession } from '../types/game.types';

export class SoloMode {
  private gameEngine: GameEngine;
  private playerName: string;

  constructor(playerName: string) {
    this.gameEngine = new GameEngine();
    this.playerName = playerName;
  }

  /**
   * Start a solo game
   */
  startGame(totalRounds: number = 5): GameSession {
    const player: Player = {
      id: `player_${Date.now()}`,
      name: this.playerName,
      score: 0,
      answers: {},
    };

    return this.gameEngine.initializeGame('solo', [player], totalRounds);
  }

  /**
   * Get next round
   */
  getNextRound() {
    return this.gameEngine.startRound();
  }

  /**
   * Submit player answers
   */
  submitRoundAnswers(playerId: string, answers: Record<string, string>) {
    const currentRound = this.gameEngine.startRound();
    this.gameEngine.submitAnswers(playerId, answers, currentRound);
  }

  /**
   * Advance to next round or end game
   */
  nextRound(): boolean {
    return this.gameEngine.nextRound();
  }

  /**
   * Get final results
   */
  endGame() {
    return this.gameEngine.endGame();
  }

  /**
   * Get current game state
   */
  getGameState() {
    return this.gameEngine.getGameState();
  }
}
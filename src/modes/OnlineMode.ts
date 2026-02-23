import { MatchmakingRequest, GameSession, Player } from '../types/game.types';
import { GameEngine } from '../core/GameEngine';

export class OnlineMode {
  private gameEngine: GameEngine;
  private playerId: string;
  private playerName: string;
  private websocketClient: any; // Will be initialized with actual WebSocket

  constructor(playerId: string, playerName: string) {
    this.gameEngine = new GameEngine();
    this.playerId = playerId;
    this.playerName = playerName;
  }

  /**
   * Request to join a matchmaking queue
   */
  requestMatch(difficulty: 'easy' | 'medium' | 'hard'): MatchmakingRequest {
    return {
      playerId: this.playerId,
      playerName: this.playerName,
      difficulty,
      timestamp: new Date(),
    };
  }

  /**
   * Initialize game with matched opponent
   */
  startGameWithOpponent(opponentId: string, opponentName: string, totalRounds: number = 5): GameSession {
    const players: Player[] = [
      {
        id: this.playerId,
        name: this.playerName,
        score: 0,
        answers: {},
      },
      {
        id: opponentId,
        name: opponentName,
        score: 0,
        answers: {},
      },
    ];

    return this.gameEngine.initializeGame('online', players, totalRounds);
  }

  /**
   * Submit answers in online game
   */
  submitRoundAnswers(answers: Record<string, string>) {
    const currentRound = this.gameEngine.startRound();
    this.gameEngine.submitAnswers(this.playerId, answers, currentRound);
  }

  /**
   * Sync game state with server
   */
  syncGameState(gameState: GameSession) {
    // Send game state to server via WebSocket
    console.log('Syncing game state:', gameState);
  }

  /**
   * Get game state
   */
  getGameState() {
    return this.gameEngine.getGameState();
  }
}
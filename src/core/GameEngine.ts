import { GameRound, Player, GameSession } from '../types/game.types';
import { ScoringSystem } from './ScoringSystem';
import { RoundManager } from './RoundManager';

export class GameEngine {
  private scoringSystem: ScoringSystem;
  private roundManager: RoundManager;
  private currentSession: GameSession | null = null;

  constructor() {
    this.scoringSystem = new ScoringSystem();
    this.roundManager = new RoundManager();
  }

  /**
   * Initialize a new game session
   */
  initializeGame(gameMode: 'solo' | 'online', players: Player[], totalRounds: number = 5): GameSession {
    this.currentSession = {
      id: this.generateSessionId(),
      gameMode,
      players,
      currentRound: 1,
      totalRounds,
      status: 'active',
      createdAt: new Date(),
    };

    return this.currentSession;
  }

  /**
   * Start a new round with a random letter
   */
  startRound(): GameRound {
    if (!this.currentSession) {
      throw new Error('Game session not initialized');
    }

    const letter = this.roundManager.generateRandomLetter();
    const categories = this.roundManager.getCategories();

    return {
      letter,
      categories,
      answers: {},
      scores: {},
      timeLimit: 120, // 2 minutes
    };
  }

  /**
   * Submit answers for a round
   */
  submitAnswers(playerId: string, answers: Record<string, string>, currentRound: GameRound): void {
    if (!this.currentSession) {
      throw new Error('Game session not initialized');
    }

    const player = this.currentSession.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found in session');
    }

    player.answers = answers;

    // Calculate scores
    const roundScores = this.scoringSystem.calculateScores(
      answers,
      currentRound.answers,
      this.currentSession.players.map(p => p.answers)
    );

    player.score += roundScores[playerId] || 0;
  }

  /**
   * Get current game state
   */
  getGameState(): GameSession {
    if (!this.currentSession) {
      throw new Error('No active game session');
    }
    return this.currentSession;
  }

  /**
   * Advance to next round
   */
  nextRound(): boolean {
    if (!this.currentSession) {
      throw new Error('No active game session');
    }

    if (this.currentSession.currentRound >= this.currentSession.totalRounds) {
      this.currentSession.status = 'completed';
      return false;
    }

    this.currentSession.currentRound++;
    return true;
  }

  /**
   * End the game and return final results
   */
  endGame(): Player[] {
    if (!this.currentSession) {
      throw new Error('No active game session');
    }

    this.currentSession.status = 'completed';
    return this.currentSession.players.sort((a, b) => b.score - a.score);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
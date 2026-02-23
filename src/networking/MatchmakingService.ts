import { MatchmakingRequest } from '../types/game.types';
import { WebSocketClient } from './WebSocketClient';

export class MatchmakingService {
  private wsClient: WebSocketClient;
  private waitingPlayers: Map<string, MatchmakingRequest> = new Map();

  constructor(wsClient: WebSocketClient) {
    this.wsClient = wsClient;
  }

  /**
   * Queue player for matchmaking
   */
  requestMatch(request: MatchmakingRequest): void {
    this.waitingPlayers.set(request.playerId, request);
    this.wsClient.send({
      type: 'matchmaking-request',
      payload: request,
    });
  }

  /**
   * Find opponent from waiting players
   */
  findOpponent(difficulty: string): MatchmakingRequest | null {
    for (const [, player] of this.waitingPlayers) {
      if (player.difficulty === difficulty) {
        return player;
      }
    }
    return null;
  }

  /**
   * Handle match found event
   */
  onMatchFound(callback: (opponentId: string, opponentName: string) => void): void {
    this.wsClient.send({
      type: 'matchmaking-listen',
      payload: { callback: callback.toString() },
    });
  }

  /**
   * Cancel matchmaking request
   */
  cancelMatchmaking(playerId: string): void {
    this.waitingPlayers.delete(playerId);
    this.wsClient.send({
      type: 'matchmaking-cancel',
      payload: { playerId },
    });
  }
}
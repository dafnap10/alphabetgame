export interface GameRound {
  letter: string;
  categories: string[];
  answers: Record<string, string>;
  scores: Record<string, number>;
  timeLimit?: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  answers: Record<string, string>;
}

export interface GameSession {
  id: string;
  gameMode: 'solo' | 'online';
  players: Player[];
  currentRound: number;
  totalRounds: number;
  status: 'waiting' | 'active' | 'completed';
  createdAt: Date;
}

export interface MatchmakingRequest {
  playerId: string;
  playerName: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timestamp: Date;
}

export interface GameAnswer {
  category: string;
  answer: string;
  isValid: boolean;
  points: number;
}
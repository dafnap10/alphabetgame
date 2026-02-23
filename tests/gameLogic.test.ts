import { GameEngine } from '../src/core/GameEngine';
import { ScoringSystem } from '../src/core/ScoringSystem';
import { RoundManager } from '../src/core/RoundManager';
import { SoloMode } from '../src/modes/SoloMode';
import { Player } from '../src/types/game.types';

describe('GameEngine', () => {
  let gameEngine: GameEngine;

  beforeEach(() => {
    gameEngine = new GameEngine();
  });

  test('should initialize a game session', () => {
    const players: Player[] = [
      { id: 'p1', name: 'Player 1', score: 0, answers: {} },
    ];

    const session = gameEngine.initializeGame('solo', players, 5);

    expect(session.gameMode).toBe('solo');
    expect(session.players).toHaveLength(1);
    expect(session.currentRound).toBe(1);
    expect(session.totalRounds).toBe(5);
    expect(session.status).toBe('active');
  });

  test('should start a new round', () => {
    const players: Player[] = [
      { id: 'p1', name: 'Player 1', score: 0, answers: {} },
    ];

    gameEngine.initializeGame('solo', players, 5);
    const round = gameEngine.startRound();

    expect(round.letter).toMatch(/^[A-Z]$/);
    expect(round.categories).toHaveLength(6);
    expect(round.timeLimit).toBe(120);
  });

  test('should advance to next round', () => {
    const players: Player[] = [
      { id: 'p1', name: 'Player 1', score: 0, answers: {} },
    ];

    gameEngine.initializeGame('solo', players, 5);
    const result = gameEngine.nextRound();

    expect(result).toBe(true);
    const state = gameEngine.getGameState();
    expect(state.currentRound).toBe(2);
  });

  test('should end game when max rounds reached', () => {
    const players: Player[] = [
      { id: 'p1', name: 'Player 1', score: 0, answers: {} },
    ];

    gameEngine.initializeGame('solo', players, 1);
    const result = gameEngine.nextRound();

    expect(result).toBe(false);
    const state = gameEngine.getGameState();
    expect(state.status).toBe('completed');
  });
});

describe('ScoringSystem', () => {
  let scoringSystem: ScoringSystem;

  beforeEach(() => {
    scoringSystem = new ScoringSystem();
  });

  test('should calculate scores correctly', () => {
    const playerAnswers = {
      Country: 'Canada',
      City: 'Cairo',
      Animal: 'Cat',
    };

    const correctAnswers = {
      Country: 'Canada',
      City: 'Cairo',
      Animal: 'Cat',
    };

    const allAnswers = [
      { Country: 'Canada', City: 'Cairo', Animal: 'Cat' },
    ];

    const scores = scoringSystem.calculateScores(
      playerAnswers,
      correctAnswers,
      allAnswers
    );

    expect(scores.Country).toBeGreaterThan(0);
  });
});

describe('RoundManager', () => {
  let roundManager: RoundManager;

  beforeEach(() => {
    roundManager = new RoundManager();
  });

  test('should generate a valid letter', () => {
    const letter = roundManager.generateRandomLetter();
    expect(letter).toMatch(/^[A-Z]$/);
  });

  test('should return categories', () => {
    const categories = roundManager.getCategories();
    expect(categories).toHaveLength(6);
    expect(categories).toContain('Country');
    expect(categories).toContain('City');
  });

  test('should validate answers', () => {
    const valid = roundManager.validateAnswer('Canada', 'Country');
    const invalid = roundManager.validateAnswer('', 'Country');

    expect(valid).toBe(true);
    expect(invalid).toBe(false);
  });
});

describe('SoloMode', () => {
  let soloMode: SoloMode;

  beforeEach(() => {
    soloMode = new SoloMode('TestPlayer');
  });

  test('should start a solo game', () => {
    const session = soloMode.startGame(5);

    expect(session.gameMode).toBe('solo');
    expect(session.players[0].name).toBe('TestPlayer');
    expect(session.status).toBe('active');
  });

  test('should get next round', () => {
    soloMode.startGame(5);
    const round = soloMode.getNextRound();

    expect(round.letter).toMatch(/^[A-Z]$/);
    expect(round.categories).toBeDefined();
  });
});
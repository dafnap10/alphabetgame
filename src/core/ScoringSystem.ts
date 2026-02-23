export class ScoringSystem {
  /**
   * Calculate scores based on answers
   * Unique answers get more points
   * Correct answers but repeated get fewer points
   */
  calculateScores(
    playerAnswers: Record<string, string>,
    correctAnswers: Record<string, string>,
    allPlayersAnswers: Record<string, string>[]
  ): Record<string, number> {
    const scores: Record<string, number> = {};
    let totalScore = 0;

    Object.entries(playerAnswers).forEach(([category, answer]) => {
      const points = this.scoreAnswer(
        answer,
        category,
        correctAnswers[category],
        allPlayersAnswers
      );
      totalScore += points;
    });

    scores[Object.keys(playerAnswers)[0]] = totalScore;
    return scores;
  }

  /**
   * Score individual answer based on:
   * - Correctness
   * - Uniqueness (fewer players with same answer = more points)
   */
  private scoreAnswer(
    answer: string,
    category: string,
    correctAnswer: string,
    allPlayersAnswers: Record<string, string>[]
  ): number {
    if (!answer || answer.trim() === '') {
      return 0;
    }

    let points = 10; // Base points

    // Count how many players gave the same answer
    const sameAnswerCount = allPlayersAnswers.filter(
      pa => pa[category]?.toLowerCase() === answer.toLowerCase()
    ).length;

    if (sameAnswerCount > 1) {
      points = 5; // Shared answer = fewer points
    }

    // Bonus for correct answer
    if (answer.toLowerCase() === correctAnswer?.toLowerCase()) {
      points += 5;
    }

    return points;
  }

  /**
   * Get leaderboard
   */
  getLeaderboard(players: Array<{ id: string; name: string; score: number }>) {
    return players.sort((a, b) => b.score - a.score);
  }
}
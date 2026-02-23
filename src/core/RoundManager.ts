export class RoundManager {
  private letters: string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  private categories: string[] = [
    'Country',
    'City',
    'Animal',
    'Food',
    'Name',
    'Color',
  ];

  /**
   * Generate a random letter for the round
   */
  generateRandomLetter(): string {
    return this.letters[Math.floor(Math.random() * this.letters.length)];
  }

  /**
   * Get game categories
   */
  getCategories(): string[] {
    return this.categories;
  }

  /**
   * Validate an answer
   */
  validateAnswer(answer: string, category: string): boolean {
    // Basic validation - can be extended with dictionary/API checks
    const minLength = 2;
    return answer.trim().length >= minLength;
  }
}
import { createCard } from './Card';
import { ICard, Rank, Suit } from './Types';

export class Deck {
  private cards: ICard[] = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.cards = [];
    let id = 0;
    const suits = [Suit.SPADES, Suit.CLUBS, Suit.DIAMONDS, Suit.HEARTS];
    for (const suit of suits) {
      for (let rank = Rank.ACE; rank <= Rank.KING; rank++) {
        this.cards.push(createCard(suit, rank, id++));
      }
    }
  }

  public shuffle(): void {
    // Fisher-Yates shuffle
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  public draw(): ICard | null {
    return this.cards.pop() ?? null;
  }

  public get remainingCount(): number {
    return this.cards.length;
  }

  public getCards(): ICard[] {
    return [...this.cards];
  }

  /**
   * Chia bài cho 4 người:
   * dealerSeat: người nhận 10 lá và đánh đầu
   * Các người còn lại nhận 9 lá.
   * Số còn lại làm Nọc (15 lá).
   */
  public deal(dealerSeat: number): { hands: ICard[][]; stock: ICard[] } {
    this.reset();
    this.shuffle();

    const hands: ICard[][] = [[], [], [], []];
    // Mỗi người nhận bài
    for (let seat = 0; seat < 4; seat++) {
      const count = seat === dealerSeat ? 10 : 9;
      for (let i = 0; i < count; i++) {
        const card = this.draw();
        if (card) hands[seat].push(card);
      }
    }

    return {
      hands,
      stock: [...this.cards],
    };
  }
}

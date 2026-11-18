import { ICard, Rank, Suit } from './Types';

export function createCard(suit: Suit, rank: Rank, id?: number): ICard {
  return {
    id: id !== undefined ? id : suit * 13 + (rank - 1),
    suit,
    rank,
  };
}

export function getRankLabel(rank: Rank): string {
  switch (rank) {
    case Rank.ACE:
      return 'A';
    case Rank.JACK:
      return 'J';
    case Rank.QUEEN:
      return 'Q';
    case Rank.KING:
      return 'K';
    default:
      return rank.toString();
  }
}

export function getSuitSymbol(suit: Suit): string {
  switch (suit) {
    case Suit.SPADES:
      return '♠';
    case Suit.CLUBS:
      return '♣';
    case Suit.DIAMONDS:
      return '♦';
    case Suit.HEARTS:
      return '♥';
  }
}

export function getSuitColor(suit: Suit): string {
  return suit === Suit.HEARTS || suit === Suit.DIAMONDS ? '#e53935' : '#212121';
}

export function cardToString(card: ICard): string {
  return `${getRankLabel(card.rank)}${getSuitSymbol(card.suit)}`;
}

export function getCardPoint(card: ICard): number {
  // A=1, 2..10=2..10, J=11, Q=12, K=13
  return card.rank;
}

export function sortCardsByRank(cards: ICard[]): ICard[] {
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    return a.suit - b.suit;
  });
}

export function sortCardsBySuit(cards: ICard[]): ICard[] {
  return [...cards].sort((a, b) => {
    if (a.suit !== b.suit) {
      return a.suit - b.suit;
    }
    return a.rank - b.rank;
  });
}

export function areCardsEqual(c1: ICard, c2: ICard): boolean {
  return c1.id === c2.id || (c1.suit === c2.suit && c1.rank === c2.rank);
}

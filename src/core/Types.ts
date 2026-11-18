export enum Suit {
  SPADES = 0,   // Bích ♠
  CLUBS = 1,    // Tép / Nhép ♣
  DIAMONDS = 2, // Rô ♦
  HEARTS = 3,   // Cơ ♥
}

export enum Rank {
  ACE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
  NINE = 9,
  TEN = 10,
  JACK = 11,
  QUEEN = 12,
  KING = 13,
}

export interface ICard {
  id: number;           // 0 -> 51
  suit: Suit;
  rank: Rank;
  isEaten?: boolean;    // Cây bài được ăn từ người khác
  eatenFromSeat?: number; // Ghế người bị ăn
}

export type PhomType = 'SAP' | 'SANH';

export interface IPhom {
  id: string;
  type: PhomType;
  cards: ICard[];
  ownerSeat: number;
}

export interface ISendTarget {
  card: ICard;
  targetSeat: number;
  targetPhomId: string;
}

export type TurnPhase =
  | 'WAITING_FOR_ACTION' // Bắt đầu lượt: Ăn bài hoặc Bốc bài
  | 'ACTION_TAKEN'       // Đã ăn hoặc bốc, chờ Đánh hoặc Hạ
  | 'LAYING_PHOMS'       // Lượt thứ 4: Hạ phỏm
  | 'SENDING_CARDS'      // Lượt thứ 4: Gửi bài rác vào phỏm người khác
  | 'DISCARDING'         // Chọn bài rác để đánh (hoặc đánh chốt)
  | 'ROUND_ENDED';       // Kết thúc ván

export interface IPlayer {
  seat: number;          // 0 = Bạn (dưới), 1 = Bot Nam (trái), 2 = Bot Bắc (trên), 3 = Bot Tây (phải)
  name: string;
  avatar: string;
  coins: number;
  isBot: boolean;
  hand: ICard[];         // Bài trên tay
  eatenCards: ICard[];   // Các cây đã ăn từ người khác
  discardedCards: ICard[]; // Các cây đã đánh ra
  laidPhoms: IPhom[];    // Các phỏm đã hạ trên bàn
  sentCards: ISendTarget[]; // Các cây đã gửi vào phỏm người khác
  hasLaidPhoms: boolean;
  isMom: boolean;
  isU: boolean;
  isUKhan: boolean;
  uType?: 'U_THUONG' | 'U_TRON' | 'U_KHAN';
  score: number;         // Tổng điểm rác còn lại
  finalRank: number;     // 1: Nhất, 2: Nhì, 3: Ba, 4: Bét
  totalCoinChange: number;
}

export interface IGameSettings {
  betAmount: number;
  turnTimeoutSeconds: number;
}

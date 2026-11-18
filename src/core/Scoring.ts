import { getCardPoint } from './Card';
import { ICard, IPlayer } from './Types';

export interface IRoundResult {
  winnerSeat: number;
  isU: boolean;
  uType?: 'U_THUONG' | 'U_TRON' | 'U_KHAN';
  standings: {
    seat: number;
    name: string;
    finalRank: number; // 1, 2, 3, 4
    score: number;
    isMom: boolean;
    isU: boolean;
    deadwood: ICard[];
    coinChange: number;
  }[];
}

/**
 * Tính tổng điểm của các quân bài rác (A=1, 2..10, J=11, Q=12, K=13)
 */
export function calculateDeadwoodScore(cards: ICard[]): number {
  return cards.reduce((sum, card) => sum + getCardPoint(card), 0);
}

/**
 * Phân định thứ hạng 4 người chơi khi ván bài kết thúc theo luật Tá Lả miền Bắc.
 */
export function rankPlayers(players: IPlayer[]): {
  standings: { seat: number; finalRank: number; score: number; isMom: boolean; isU: boolean }[];
  winnerSeat: number;
  isU: boolean;
  uType?: 'U_THUONG' | 'U_TRON' | 'U_KHAN';
} {
  // 1. Kiểm tra có ai Ù không
  const uPlayer = players.find((p) => p.isU);
  if (uPlayer) {
    const standings = players.map((p) => ({
      seat: p.seat,
      finalRank: p.seat === uPlayer.seat ? 1 : 4,
      score: p.seat === uPlayer.seat ? 0 : p.score,
      isMom: p.isMom,
      isU: p.seat === uPlayer.seat,
    }));

    return {
      standings,
      winnerSeat: uPlayer.seat,
      isU: true,
      uType: uPlayer.uType,
    };
  }

  // 2. Không ai Ù: Phân loại người có Phỏm và người Móm
  const nonMomPlayers = players.filter((p) => !p.isMom);
  const momPlayers = players.filter((p) => p.isMom);

  // Sắp xếp người có phỏm: Điểm thấp hơn xếp trước.
  // Nếu bằng điểm: Người hạ phỏm trước (ghế hạ trước) xếp trước.
  nonMomPlayers.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.seat - b.seat;
  });

  // Người Móm luôn xếp sau người có phỏm
  momPlayers.sort((a, b) => a.seat - b.seat);

  const sortedAll = [...nonMomPlayers, ...momPlayers];
  const standings = sortedAll.map((p, index) => ({
    seat: p.seat,
    finalRank: index + 1, // 1, 2, 3, 4
    score: p.score,
    isMom: p.isMom,
    isU: false,
  }));

  return {
    standings,
    winnerSeat: sortedAll[0].seat,
    isU: false,
  };
}

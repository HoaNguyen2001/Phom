import { areCardsEqual, sortCardsByRank } from './Card';
import { isValidPhom } from './PhomDetector';
import { ICard, IPhom, ISendTarget } from './Types';

export interface ISendOption {
  card: ICard;
  targetSeat: number;
  targetPhomId: string;
  targetPhomCards: ICard[];
}

/**
 * Kiểm tra xem 1 lá bài rác có thể ghép vào 1 Phỏm có sẵn hay không.
 */
export function canCardBeSentToPhom(card: ICard, phom: IPhom): boolean {
  // Không gửi lá bài đã có trong phỏm
  if (phom.cards.some((c) => areCardsEqual(c, card))) return false;

  const testCards = [...phom.cards, card];
  const check = isValidPhom(testCards);
  return check.valid;
}

/**
 * Tìm tất cả các lá bài rác có thể gửi vào các Phỏm đã hạ của người khác.
 * deadwood: danh sách bài rác của người chơi
 * opponentPhoms: danh sách tất cả các phỏm của những người ĐÃ HẠ TRƯỚC ĐÓ
 */
export function findSendableCards(
  deadwood: ICard[],
  opponentPhoms: IPhom[]
): ISendOption[] {
  const sendable: ISendOption[] = [];

  for (const card of deadwood) {
    for (const phom of opponentPhoms) {
      if (canCardBeSentToPhom(card, phom)) {
        sendable.push({
          card,
          targetSeat: phom.ownerSeat,
          targetPhomId: phom.id,
          targetPhomCards: phom.cards,
        });
      }
    }
  }

  return sendable;
}

/**
 * Tự động gửi tất cả bài rác có thể gửi (dành cho Bot AI hoặc nút Gửi Nhanh).
 * Cho phép gửi dây chuyền (VD: phỏm 7-8-9, có cả 6 và 5 thì gửi 6 rồi gửi tiếp 5).
 */
export function autoSendAllCards(
  deadwood: ICard[],
  allLaidPhoms: IPhom[]
): {
  remainingDeadwood: ICard[];
  sentHistory: ISendTarget[];
  updatedPhoms: IPhom[];
} {
  let currentDeadwood = [...deadwood];
  // Clone phoms để không làm hỏng dữ liệu gốc khi thử nghiệm
  let currentPhoms: IPhom[] = allLaidPhoms.map((p) => ({
    ...p,
    cards: [...p.cards],
  }));

  const sentHistory: ISendTarget[] = [];
  let found = true;

  while (found) {
    found = false;
    for (let i = 0; i < currentDeadwood.length; i++) {
      const card = currentDeadwood[i];
      for (const phom of currentPhoms) {
        if (canCardBeSentToPhom(card, phom)) {
          // Gửi thành công!
          phom.cards.push(card);
          phom.cards = sortCardsByRank(phom.cards);
          sentHistory.push({
            card,
            targetSeat: phom.ownerSeat,
            targetPhomId: phom.id,
          });
          currentDeadwood.splice(i, 1);
          found = true;
          break;
        }
      }
      if (found) break; // Tiếp tục vòng lặp mới với bài rác còn lại
    }
  }

  return {
    remainingDeadwood: currentDeadwood,
    sentHistory,
    updatedPhoms: currentPhoms,
  };
}

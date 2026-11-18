import { areCardsEqual, getCardPoint, sortCardsByRank } from './Card';
import { ICard, IPhom, PhomType, Rank } from './Types';

/**
 * Kiểm tra danh sách bài có tạo thành 1 Phỏm hợp lệ hay không.
 */
export function isValidPhom(cards: ICard[]): { valid: boolean; type?: PhomType } {
  if (cards.length < 3) return { valid: false };

  // 1. Kiểm tra Phỏm Sáp (3 hoặc 4 cây cùng số)
  const firstRank = cards[0].rank;
  const isSap = cards.every((c) => c.rank === firstRank);
  if (isSap) {
    if (cards.length === 3 || cards.length === 4) {
      // Phải khác chất nhau (được đảm bảo bởi bộ bài 52 lá chuẩn)
      const suits = new Set(cards.map((c) => c.suit));
      if (suits.size === cards.length) {
        return { valid: true, type: 'SAP' };
      }
    }
    return { valid: false };
  }

  // 2. Kiểm tra Phỏm Sảnh (3 lá trở lên cùng chất, liên tiếp nhau)
  const firstSuit = cards[0].suit;
  const isSameSuit = cards.every((c) => c.suit === firstSuit);
  if (!isSameSuit) return { valid: false };

  // Sắp xếp tăng dần theo rank
  const sorted = [...cards].sort((a, b) => a.rank - b.rank);

  // Kiểm tra liên tiếp: Trong tá lả miền Bắc, A=1 (A-2-3.. hoặc ..10-J-Q-K)
  // Không cho phép vòng K-A-2
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1].rank !== sorted[i].rank + 1) {
      return { valid: false };
    }
  }

  return { valid: true, type: 'SANH' };
}

/**
 * Tìm tất cả các Phỏm đơn lẻ có thể tạo được từ một nhóm quân bài.
 */
export function findAllPossiblePhoms(cards: ICard[], ownerSeat = 0): IPhom[] {
  const result: IPhom[] = [];
  let phomIndex = 0;

  // 1. Tìm tất cả Phỏm Sáp (nhóm theo rank)
  const rankGroups = new Map<Rank, ICard[]>();
  for (const card of cards) {
    if (!rankGroups.has(card.rank)) rankGroups.set(card.rank, []);
    rankGroups.get(card.rank)!.push(card);
  }

  for (const [rank, group] of rankGroups.entries()) {
    if (group.length === 3) {
      result.push({
        id: `phom_${ownerSeat}_${phomIndex++}`,
        type: 'SAP',
        cards: [...group],
        ownerSeat,
      });
    } else if (group.length === 4) {
      // Nhóm 4 lá sáp
      result.push({
        id: `phom_${ownerSeat}_${phomIndex++}`,
        type: 'SAP',
        cards: [...group],
        ownerSeat,
      });
      // Hoặc 4 tổ hợp 3 lá sáp
      for (let i = 0; i < 4; i++) {
        result.push({
          id: `phom_${ownerSeat}_${phomIndex++}`,
          type: 'SAP',
          cards: group.filter((_, idx) => idx !== i),
          ownerSeat,
        });
      }
    }
  }

  // 2. Tìm tất cả Phỏm Sảnh (nhóm theo suit)
  const suitGroups = new Map<number, ICard[]>();
  for (const card of cards) {
    if (!suitGroups.has(card.suit)) suitGroups.set(card.suit, []);
    suitGroups.get(card.suit)!.push(card);
  }

  for (const [_, group] of suitGroups.entries()) {
    if (group.length < 3) continue;
    const sorted = [...group].sort((a, b) => a.rank - b.rank);

    // Tìm tất cả các chuỗi liên tiếp có độ dài >= 3
    for (let start = 0; start < sorted.length; start++) {
      for (let end = start + 2; end < sorted.length; end++) {
        const sub = sorted.slice(start, end + 1);
        const check = isValidPhom(sub);
        if (check.valid && check.type === 'SANH') {
          result.push({
            id: `phom_${ownerSeat}_${phomIndex++}`,
            type: 'SANH',
            cards: sub,
            ownerSeat,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Kiểm tra xem 2 phỏm có bị trùng quân bài nào không
 */
function arePhomsDisjoint(p1: IPhom, p2: IPhom): boolean {
  for (const c1 of p1.cards) {
    for (const c2 of p2.cards) {
      if (areCardsEqual(c1, c2)) return false;
    }
  }
  return true;
}

/**
 * Tìm phương án ghép Phỏm tối ưu nhất cho bộ bài (để điểm bài rác còn lại thấp nhất).
 * BẮT BUỘC: Tất cả các quân bài trong eatenCards phải nằm trong Phỏm!
 */
export function findBestPhomCombination(
  hand: ICard[],
  eatenCards: ICard[] = [],
  ownerSeat = 0
): { phoms: IPhom[]; deadwood: ICard[]; score: number } {
  const allCards = [...hand];
  const possiblePhoms = findAllPossiblePhoms(allCards, ownerSeat);

  // Tìm các tập phỏm không xung đột (disjoint subsets)
  const validCombinations: IPhom[][] = [[]];

  function search(current: IPhom[], startIndex: number) {
    for (let i = startIndex; i < possiblePhoms.length; i++) {
      const candidate = possiblePhoms[i];
      const isDisjoint = current.every((p) => arePhomsDisjoint(p, candidate));
      if (isDisjoint) {
        const next = [...current, candidate];
        validCombinations.push(next);
        search(next, i + 1);
      }
    }
  }

  search([], 0);

  // Lọc các kết hợp BẮT BUỘC phải chứa tất cả eatenCards
  const eatenCardIds = new Set(eatenCards.map((c) => c.id));
  const candidateCombinations = validCombinations.filter((phomList) => {
    if (eatenCardIds.size === 0) return true;
    const cardsInPhoms = new Set<number>();
    for (const p of phomList) {
      for (const c of p.cards) {
        cardsInPhoms.add(c.id);
      }
    }
    for (const id of eatenCardIds) {
      if (!cardsInPhoms.has(id)) return false;
    }
    return true;
  });

  if (candidateCombinations.length === 0) {
    // Không có cách ghép nào chứa đủ bài đã ăn (hiếm khi xảy ra nếu chỉ cho ăn khi hợp lệ)
    const deadwood = [...allCards];
    const score = deadwood.reduce((sum, c) => sum + getCardPoint(c), 0);
    return { phoms: [], deadwood, score };
  }

  // Chọn kết hợp có điểm rác thấp nhất
  let bestPhoms: IPhom[] = [];
  let bestDeadwood: ICard[] = allCards;
  let minScore = Infinity;

  for (const phomList of candidateCombinations) {
    const cardInPhomIds = new Set<number>();
    for (const p of phomList) {
      for (const c of p.cards) cardInPhomIds.add(c.id);
    }

    const deadwood = allCards.filter((c) => !cardInPhomIds.has(c.id));
    const score = deadwood.reduce((sum, c) => sum + getCardPoint(c), 0);

    if (
      score < minScore ||
      (score === minScore && phomList.length > bestPhoms.length)
    ) {
      minScore = score;
      bestPhoms = phomList;
      bestDeadwood = deadwood;
    }
  }

  return {
    phoms: bestPhoms,
    deadwood: sortCardsByRank(bestDeadwood),
    score: minScore,
  };
}

/**
 * Kiểm tra người chơi có thể ĂN một quân bài rác hay không.
 * Điều kiện:
 * 1. Quân bài rác + bài trên tay tạo thành ít nhất 1 Phỏm mới chứa quân bài đó.
 * 2. Tất cả các quân bài đã ăn trước đó VẪN BẮT BUỘC nằm trong phỏm hợp lệ!
 */
export function canEatCard(
  hand: ICard[],
  eatenCards: ICard[],
  discardedCard: ICard
): { canEat: boolean; matchedCombinations: ICard[][] } {
  const extendedHand = [...hand, { ...discardedCard, isEaten: true }];
  const allEaten = [...eatenCards, { ...discardedCard, isEaten: true }];

  // Tìm tất cả phỏm khả thi chứa discardedCard
  const allPhoms = findAllPossiblePhoms(extendedHand);
  const phomsContainingCard = allPhoms.filter((p) =>
    p.cards.some((c) => areCardsEqual(c, discardedCard))
  );

  if (phomsContainingCard.length === 0) {
    return { canEat: false, matchedCombinations: [] };
  }

  // Thử từng phỏm xem có tồn tại phương án phân rã sao cho chứa được cả discardedCard và tất cả eatenCards cũ không
  const matchedCombinations: ICard[][] = [];

  for (const p of phomsContainingCard) {
    // Các quân còn lại
    const remainingCards = extendedHand.filter(
      (c) => !p.cards.some((pc) => areCardsEqual(pc, c))
    );
    // Các quân ăn cũ phải nằm trong remainingCards
    const otherEaten = eatenCards;
    const canCoverOthers = findBestPhomCombination(remainingCards, otherEaten);

    // Kiểm tra xem các eaten cũ có bị rớt ra ngoài deadwood không
    const remainingDeadwoodIds = new Set(canCoverOthers.deadwood.map((c) => c.id));
    const allEatenCovered = otherEaten.every((c) => !remainingDeadwoodIds.has(c.id));

    if (allEatenCovered) {
      matchedCombinations.push(p.cards);
    }
  }

  return {
    canEat: matchedCombinations.length > 0,
    matchedCombinations,
  };
}

/**
 * Kiểm tra Ù Khan (bài 9 lá khi chia xong không có bất kỳ một cạ nào).
 * Cạ = 2 lá cùng số HOẶC 2 lá cùng chất có khoảng cách rank <= 2 (VD: 3-4 hoặc 3-5).
 */
export function isUKhan(hand: ICard[]): boolean {
  if (hand.length < 9) return false;

  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const c1 = hand[i];
      const c2 = hand[j];

      // Đôi cùng số
      if (c1.rank === c2.rank) return false;

      // Cùng chất và sát nhau (rank diff <= 2)
      if (c1.suit === c2.suit && Math.abs(c1.rank - c2.rank) <= 2) {
        return false;
      }
    }
  }
  return true;
}

import { areCardsEqual, getCardPoint } from './Card';
import { canEatCard, findBestPhomCombination } from './PhomDetector';
import { autoSendAllCards } from './SendCardDetector';
import { ICard, IPhom } from './Types';

export class BotAI {
  /**
   * Quyết định xem Bot có nên ĂN lá bài rác của người cửa trên đánh ra không.
   */
  public static shouldEatCard(
    hand: ICard[],
    eatenCards: ICard[],
    discardedCard: ICard
  ): { shouldEat: boolean; phomCards?: ICard[] } {
    const eatCheck = canEatCard(hand, eatenCards, discardedCard);
    if (!eatCheck.canEat || eatCheck.matchedCombinations.length === 0) {
      return { shouldEat: false };
    }

    // Luôn ưu tiên ăn nếu hợp lệ vì sẽ có thêm Phỏm chắc chắn
    return {
      shouldEat: true,
      phomCards: eatCheck.matchedCombinations[0],
    };
  }

  /**
   * Chọn lá bài rác tối ưu nhất để đánh ra bàn.
   * isChot: Có phải lượt đánh thứ 4 (đánh cây chốt) không?
   * tableDiscardedCards: Tất cả các lá bài rác đã từng đánh trên bàn (để tính độ an toàn).
   */
  public static chooseCardToDiscard(
    hand: ICard[],
    eatenCards: ICard[],
    isChot: boolean,
    tableDiscardedCards: ICard[]
  ): ICard {
    const bestComb = findBestPhomCombination(hand, eatenCards);
    let deadwood = bestComb.deadwood;

    // Không được đánh các lá bài đã ăn!
    const eatenIds = new Set(eatenCards.map((c) => c.id));
    deadwood = deadwood.filter((c) => !eatenIds.has(c.id));

    // Nếu không còn rác (Ù tròn), chọn bất kỳ lá nào không phải bài ăn
    if (deadwood.length === 0) {
      const candidates = hand.filter((c) => !eatenIds.has(c.id));
      return candidates[0] || hand[0];
    }

    // Đánh giá độ an toàn của từng lá bài rác
    const scoredCandidates = deadwood.map((card) => {
      let dangerScore = 0;

      // 1. Kiểm tra xem lá bài cùng rank đã xuất hiện trên bàn chưa (bài lộ)
      const sameRankSeen = tableDiscardedCards.filter((c) => c.rank === card.rank).length;
      if (sameRankSeen >= 2) {
        dangerScore -= 50; // Rất an toàn vì khó ai tạo sáp rank này
      } else if (sameRankSeen === 1) {
        dangerScore -= 20; // Khá an toàn
      }

      // 2. Kiểm tra xem cùng chất sát số đã đánh ra chưa
      const sameSuitCloseSeen = tableDiscardedCards.filter(
        (c) => c.suit === card.suit && Math.abs(c.rank - card.rank) <= 1
      ).length;
      if (sameSuitCloseSeen > 0) {
        dangerScore -= 15;
      }

      // 3. Nếu là cây Chốt, ưu tiên bài có độ nguy hiểm thấp nhất (an toàn tuyệt đối)
      if (isChot) {
        dangerScore *= 3;
      }

      // 4. Nếu bình thường, ưu tiên vứt bài điểm cao (K, Q, J) để giảm điểm
      const pointPriority = getCardPoint(card);

      return {
        card,
        effectiveScore: dangerScore - pointPriority, // Càng nhỏ càng nên đánh
      };
    });

    // Sắp xếp chọn lá có điểm đánh giá thấp nhất
    scoredCandidates.sort((a, b) => a.effectiveScore - b.effectiveScore);
    return scoredCandidates[0].card;
  }

  /**
   * Tự động Hạ Phỏm cho Bot ở lượt thứ 4.
   */
  public static getPhomsToLay(hand: ICard[], eatenCards: ICard[], seat: number): IPhom[] {
    const best = findBestPhomCombination(hand, eatenCards, seat);
    return best.phoms;
  }

  /**
   * Tự động Gửi bài cho Bot ở lượt thứ 4.
   */
  public static sendCardsToOpponents(
    deadwood: ICard[],
    opponentLaidPhoms: IPhom[]
  ) {
    return autoSendAllCards(deadwood, opponentLaidPhoms);
  }
}

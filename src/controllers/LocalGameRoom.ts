import { GAME_CONFIG } from '../config/GameConfig';
import { BotAI } from '../core/BotAI';
import { areCardsEqual, sortCardsByRank } from '../core/Card';
import { Deck } from '../core/Deck';
import { PenaltyManager } from '../core/PenaltyManager';
import { canEatCard, findAllPossiblePhoms, findBestPhomCombination, isUKhan } from '../core/PhomDetector';
import { calculateDeadwoodScore, IRoundResult, rankPlayers } from '../core/Scoring';
import { autoSendAllCards, canCardBeSentToPhom, findSendableCards } from '../core/SendCardDetector';
import { ICard, IPhom, IPlayer, ISendTarget, TurnPhase } from '../core/Types';
import { EconomyService } from '../services/EconomyService';
import { FBInstantBridge } from '../services/FBInstantBridge';

export interface IEatEffectData {
  eaterSeat: number;
  feederSeat: number;
  amount: number;
  isChot: boolean;
  card: ICard;
}

export interface IDiscardEffectData {
  discarderSeat: number;
  card: ICard;
}

export interface IDrawEffectData {
  seat: number;
}

export interface IRoomListener {
  onStateUpdate: (room: LocalGameRoom) => void;
  onLogMessage: (message: string) => void;
  onGameOver: (result: IRoundResult) => void;
  onCardEatEffect?: (data: IEatEffectData) => void;
  onCardDiscardEffect?: (data: IDiscardEffectData) => void;
  onCardDrawEffect?: (data: IDrawEffectData) => void;
}

export class LocalGameRoom {
  public players: IPlayer[] = [];
  public stock: ICard[] = [];
  public activeSeat: number = 0;
  public dealerSeat: number = 0;
  public roundNumber: number = 1; // 1 -> 4
  public turnPhase: TurnPhase = 'WAITING_FOR_ACTION';
  public lastDiscardedCard: ICard | null = null;
  public lastDiscarderSeat: number = -1;
  public betAmount: number = 1000;
  public isGameOver: boolean = false;
  public penaltyManager: PenaltyManager;

  private deck: Deck = new Deck();
  private listeners: IRoomListener[] = [];
  private botTimer: any = null;

  constructor(betAmount = 1000) {
    this.betAmount = betAmount;
    this.penaltyManager = new PenaltyManager(betAmount);
    this.initPlayers();
  }

  public addListener(listener: IRoomListener): void {
    this.listeners.push(listener);
  }

  private notifyStateUpdate(): void {
    for (const l of this.listeners) l.onStateUpdate(this);
  }

  private log(msg: string): void {
    for (const l of this.listeners) l.onLogMessage(msg);
  }

  private notifyEatEffect(data: IEatEffectData): void {
    for (const l of this.listeners) l.onCardEatEffect?.(data);
  }

  private notifyDiscardEffect(data: IDiscardEffectData): void {
    for (const l of this.listeners) l.onCardDiscardEffect?.(data);
  }

  private notifyDrawEffect(data: IDrawEffectData): void {
    for (const l of this.listeners) l.onCardDrawEffect?.(data);
  }

  private initPlayers(): void {
    const playerName = FBInstantBridge.getPlayerName();
    this.players = [
      {
        seat: 0,
        name: playerName,
        avatar: 'avatar_player',
        coins: EconomyService.getInstance().getCoins(),
        isBot: false,
        hand: [],
        eatenCards: [],
        discardedCards: [],
        laidPhoms: [],
        sentCards: [],
        hasLaidPhoms: false,
        isMom: false,
        isU: false,
        isUKhan: false,
        score: 0,
        finalRank: 0,
        totalCoinChange: 0,
      },
      {
        seat: 1,
        name: 'Tây Kiếm Khách',
        avatar: 'avatar_bot1',
        coins: 120000,
        isBot: true,
        hand: [],
        eatenCards: [],
        discardedCards: [],
        laidPhoms: [],
        sentCards: [],
        hasLaidPhoms: false,
        isMom: false,
        isU: false,
        isUKhan: false,
        score: 0,
        finalRank: 0,
        totalCoinChange: 0,
      },
      {
        seat: 2,
        name: 'Bắc Thần Bài',
        avatar: 'avatar_bot2',
        coins: 150000,
        isBot: true,
        hand: [],
        eatenCards: [],
        discardedCards: [],
        laidPhoms: [],
        sentCards: [],
        hasLaidPhoms: false,
        isMom: false,
        isU: false,
        isUKhan: false,
        score: 0,
        finalRank: 0,
        totalCoinChange: 0,
      },
      {
        seat: 3,
        name: 'Nam Đại Hiệp',
        avatar: 'avatar_bot3',
        coins: 100000,
        isBot: true,
        hand: [],
        eatenCards: [],
        discardedCards: [],
        laidPhoms: [],
        sentCards: [],
        hasLaidPhoms: false,
        isMom: false,
        isU: false,
        isUKhan: false,
        score: 0,
        finalRank: 0,
        totalCoinChange: 0,
      },
    ];
  }

  public startNewGame(dealerSeat = 0, betAmount = this.betAmount): void {
    if (this.botTimer) clearTimeout(this.botTimer);

    this.betAmount = betAmount;
    this.penaltyManager = new PenaltyManager(betAmount);
    this.dealerSeat = dealerSeat;
    this.activeSeat = dealerSeat;
    this.roundNumber = 1;
    this.isGameOver = false;
    this.lastDiscardedCard = null;
    this.lastDiscarderSeat = -1;

    this.players[0].coins = EconomyService.getInstance().getCoins();

    for (const p of this.players) {
      p.hand = [];
      p.eatenCards = [];
      p.discardedCards = [];
      p.laidPhoms = [];
      p.sentCards = [];
      p.hasLaidPhoms = false;
      p.isMom = false;
      p.isU = false;
      p.isUKhan = false;
      p.uType = undefined;
      p.score = 0;
      p.finalRank = 0;
      p.totalCoinChange = 0;
    }

    const { hands, stock } = this.deck.deal(dealerSeat);
    for (let i = 0; i < 4; i++) {
      this.players[i].hand = sortCardsByRank(hands[i]);
    }
    this.stock = stock;

    this.log(`Bắt đầu ván mới! Mức cược: ${this.betAmount.toLocaleString()} Xu. ${this.players[dealerSeat].name} đi đầu.`);

    for (const p of this.players) {
      if (p.hand.length === 9 && isUKhan(p.hand)) {
        p.isUKhan = true;
      }
    }

    this.turnPhase = 'DISCARDING';
    this.notifyStateUpdate();

    if (this.players[this.activeSeat].isBot) {
      this.scheduleBotTurn();
    }
  }

  public playerDrawCard(seat: number): boolean {
    if (seat !== this.activeSeat || this.turnPhase !== 'WAITING_FOR_ACTION') {
      return false;
    }

    const drawnCard = this.stock.pop();
    if (!drawnCard) {
      this.finishGame();
      return false;
    }

    const player = this.players[seat];
    player.hand.push(drawnCard);

    this.notifyDrawEffect({ seat });
    this.log(`${player.name} bốc 1 lá từ Nọc.`);

    // Kiểm tra Ù sau khi bốc
    const check = findBestPhomCombination(player.hand, player.eatenCards, seat);
    if (check.deadwood.length === 0) {
      player.isU = true;
      player.uType = 'U_TRON';
      this.log(`★ ${player.name} Ù TRÒN! Toàn bộ lá bài đều nằm trong Phỏm!`);
      this.finishGame();
      return true;
    }

    this.advanceToDiscardOrLayPhase(player);
    return true;
  }

  public playerEatCard(seat: number): boolean {
    if (
      seat !== this.activeSeat ||
      this.turnPhase !== 'WAITING_FOR_ACTION' ||
      !this.lastDiscardedCard ||
      this.lastDiscarderSeat === -1
    ) {
      return false;
    }

    const player = this.players[seat];
    const eatCheck = canEatCard(player.hand, player.eatenCards, this.lastDiscardedCard);

    if (!eatCheck.canEat) {
      return false;
    }

    const eatenCard = { ...this.lastDiscardedCard, isEaten: true, eatenFromSeat: this.lastDiscarderSeat };
    player.hand.push(eatenCard);
    player.eatenCards.push(eatenCard);

    const isChot = this.roundNumber === 4;
    const { penaltyAmount, description } = this.penaltyManager.recordEat(
      seat,
      this.lastDiscarderSeat,
      isChot,
      player.eatenCards.length
    );

    // Phát sự kiện bay hiệu ứng Xu và bay lá bài
    this.notifyEatEffect({
      eaterSeat: seat,
      feederSeat: this.lastDiscarderSeat,
      amount: penaltyAmount,
      isChot,
      card: eatenCard,
    });

    this.log(`★ ${player.name} ĂN lá bài của ${this.players[this.lastDiscarderSeat].name}!`);
    this.log(description);

    this.lastDiscardedCard = null;

    const best = findBestPhomCombination(player.hand, player.eatenCards, seat);
    if (best.deadwood.length === 0) {
      player.isU = true;
      player.uType = 'U_THUONG';
      this.log(`★ ${player.name} Ù sau khi ăn bài!`);
      this.finishGame();
      return true;
    }

    this.advanceToDiscardOrLayPhase(player);
    return true;
  }

  /**
   * Chuyển pha sau khi Bốc hoặc Ăn:
   * XỬ LÝ LỖI TÁI HẠ:
   * Nếu người chơi ĐÃ HẠ PHỎM từ trước (lượt Tái):
   * - Kiểm tra xem bài trên tay có ghép thêm PHỎM MỚI nào không.
   * - Nếu có: cho vào 'LAYING_PHOMS' để hạ thêm phỏm.
   * - Nếu không: bỏ qua hạ phỏm, đi thẳng vào 'SENDING_CARDS' hoặc 'DISCARDING'!
   */
  private advanceToDiscardOrLayPhase(player: IPlayer): void {
    if (this.roundNumber === 4) {
      if (player.hasLaidPhoms && player.laidPhoms.length > 0) {
        // Đã hạ phỏm rồi, kiểm tra xem có phỏm mới trên tay không
        const checkNew = findBestPhomCombination(player.hand, player.eatenCards, player.seat);
        if (checkNew.phoms.length > 0) {
          this.turnPhase = 'LAYING_PHOMS';
        } else {
          // Không có phỏm mới -> kiểm tra có bài gửi không
          const oppPhoms = this.getOpponentLaidPhoms(player.seat);
          const sendable = findSendableCards(player.hand, oppPhoms);
          if (sendable.length > 0) {
            this.turnPhase = 'SENDING_CARDS';
          } else {
            this.turnPhase = 'DISCARDING';
          }
        }
      } else {
        // Lần đầu hạ phỏm ở vòng 4
        this.turnPhase = 'LAYING_PHOMS';
      }

      this.notifyStateUpdate();

      if (player.isBot) {
        this.scheduleBotTurn();
      }
    } else {
      this.turnPhase = 'DISCARDING';
      this.notifyStateUpdate();

      if (player.isBot) {
        this.scheduleBotTurn();
      }
    }
  }

  public getOpponentLaidPhoms(mySeat: number): IPhom[] {
    const opponentPhoms: IPhom[] = [];
    for (const p of this.players) {
      if (p.seat !== mySeat && p.hasLaidPhoms && p.laidPhoms.length > 0) {
        opponentPhoms.push(...p.laidPhoms);
      }
    }
    return opponentPhoms;
  }

  /**
   * Vòng 4: Người chơi Hạ Phỏm
   * SỬA DỨT ĐIỂM LỖI MÓM:
   * - Nếu player đã có phỏm trước đó (lượt tái): TUYỆT ĐỐI KHÔNG set isMom = true!
   * - Xóa các lá bài thuộc phỏm mới khỏi player.hand.
   */
  public playerLayPhoms(seat: number, customPhoms?: IPhom[]): boolean {
    if (seat !== this.activeSeat || this.turnPhase !== 'LAYING_PHOMS') {
      return false;
    }

    const player = this.players[seat];
    const best = findBestPhomCombination(player.hand, player.eatenCards, seat);
    const phomsToLay = customPhoms || best.phoms;

    if (phomsToLay.length > 0) {
      player.laidPhoms.push(...phomsToLay);
      player.hasLaidPhoms = true;

      const laidCardIds = new Set<number>();
      for (const ph of phomsToLay) {
        for (const c of ph.cards) laidCardIds.add(c.id);
      }
      player.hand = player.hand.filter((c) => !laidCardIds.has(c.id));

      this.log(`${player.name} hạ ${phomsToLay.length} Phỏm.`);
    } else {
      // Chỉ tính là Móm nếu trước đó cũng chưa từng có phỏm nào!
      if (!player.hasLaidPhoms && player.laidPhoms.length === 0) {
        player.isMom = true;
        player.hasLaidPhoms = true;
        this.log(`⚠️ ${player.name} bị MÓM (cháy, không có phỏm nào)!`);
      } else {
        this.log(`${player.name} không có thêm phỏm mới.`);
      }
    }

    // Chuyển sang bước Gửi bài (nếu có bài gửi được)
    const oppPhoms = this.getOpponentLaidPhoms(seat);
    const sendable = findSendableCards(player.hand, oppPhoms);

    if (sendable.length > 0) {
      this.turnPhase = 'SENDING_CARDS';
    } else {
      this.turnPhase = 'DISCARDING';
    }

    this.notifyStateUpdate();

    if (player.isBot) {
      this.scheduleBotTurn();
    }
    return true;
  }

  /**
   * Gửi MỘT lá bài rác cụ thể được người chơi chọn vào phỏm đối thủ
   */
  public playerSendSingleCard(seat: number, card: ICard): boolean {
    if (seat !== this.activeSeat || this.turnPhase !== 'SENDING_CARDS') {
      return false;
    }

    const player = this.players[seat];
    if (player.isMom || player.laidPhoms.length === 0) return false;

    const oppPhoms = this.getOpponentLaidPhoms(seat);
    let sentSuccess = false;

    for (const phom of oppPhoms) {
      if (canCardBeSentToPhom(card, phom)) {
        // Gửi thành công vào phom này
        phom.cards.push(card);
        phom.cards = sortCardsByRank(phom.cards);

        player.sentCards.push({
          card,
          targetSeat: phom.ownerSeat,
          targetPhomId: phom.id,
        });

        // Xóa khỏi hand
        player.hand = player.hand.filter((c) => !areCardsEqual(c, card));
        this.log(`★ ${player.name} gửi quân ${card.rank}-${card.suit} vào phỏm của ${this.players[phom.ownerSeat].name}!`);

        // Cập nhật phỏm đối thủ
        for (const p of this.players) {
          if (p.seat === phom.ownerSeat) {
            const idx = p.laidPhoms.findIndex((lp) => lp.id === phom.id);
            if (idx !== -1) p.laidPhoms[idx] = phom;
          }
        }

        sentSuccess = true;
        break;
      }
    }

    if (sentSuccess) {
      // Kiểm tra xem còn cây nào gửi được nữa không
      const updatedOppPhoms = this.getOpponentLaidPhoms(seat);
      const remainingSendable = findSendableCards(player.hand, updatedOppPhoms);
      if (remainingSendable.length === 0) {
        this.turnPhase = 'DISCARDING';
      }
      this.notifyStateUpdate();
      return true;
    }

    return false;
  }

  /**
   * Bỏ qua gửi bài để chuyển sang Đánh bài chốt
   */
  public skipSendingCards(seat: number): boolean {
    if (seat !== this.activeSeat || this.turnPhase !== 'SENDING_CARDS') {
      return false;
    }
    this.turnPhase = 'DISCARDING';
    this.notifyStateUpdate();
    return true;
  }

  /**
   * Tự động gửi tất cả bài rác có thể gửi (dành cho Bot AI)
   */
  public playerSendCards(seat: number): boolean {
    if (seat !== this.activeSeat || this.turnPhase !== 'SENDING_CARDS') {
      return false;
    }

    const player = this.players[seat];

    if (!player.isMom && player.laidPhoms.length > 0) {
      const opponentPhoms = this.getOpponentLaidPhoms(seat);
      const deadwood = [...player.hand];

      const sendResult = autoSendAllCards(deadwood, opponentPhoms);
      if (sendResult.sentHistory.length > 0) {
        player.sentCards.push(...sendResult.sentHistory);

        const sentCardIds = new Set(sendResult.sentHistory.map((s) => s.card.id));
        player.hand = player.hand.filter((c) => !sentCardIds.has(c.id));

        this.log(`★ ${player.name} gửi thành công ${sendResult.sentHistory.length} lá bài rác vào phỏm đối thủ!`);

        for (const p of this.players) {
          if (p.seat !== seat) {
            p.laidPhoms = sendResult.updatedPhoms.filter((up) => up.ownerSeat === p.seat);
          }
        }
      }
    }

    this.turnPhase = 'DISCARDING';
    this.notifyStateUpdate();

    if (player.isBot) {
      this.scheduleBotTurn();
    }
    return true;
  }

  public getAutoDiscardCard(seat: number): ICard | null {
    const player = this.players[seat];
    const hand = player.hand;
    if (hand.length === 0) return null;

    const protectedCardIds = new Set<number>();
    for (const c of hand) {
      if (c.isEaten) protectedCardIds.add(c.id);
    }
    for (const c of player.eatenCards) {
      protectedCardIds.add(c.id);
    }

    if (!player.hasLaidPhoms) {
      const allPhoms = findAllPossiblePhoms(hand, seat);
      for (const phom of allPhoms) {
        const containsEaten = phom.cards.some((c) => protectedCardIds.has(c.id));
        if (containsEaten) {
          for (const c of phom.cards) protectedCardIds.add(c.id);
        }
      }
    }

    let eligibleCards = hand.filter((c) => !protectedCardIds.has(c.id));
    if (eligibleCards.length === 0) {
      eligibleCards = hand.filter((c) => !c.isEaten);
      if (eligibleCards.length === 0) eligibleCards = [hand[0]];
    }

    if (!player.hasLaidPhoms) {
      const best = findBestPhomCombination(hand, player.eatenCards, seat);
      const phomCardIds = new Set<number>();
      for (const p of best.phoms) {
        for (const c of p.cards) phomCardIds.add(c.id);
      }
      const deadwoodEligible = eligibleCards.filter((c) => !phomCardIds.has(c.id));
      if (deadwoodEligible.length > 0) {
        const randIdx = Math.floor(Math.random() * deadwoodEligible.length);
        return deadwoodEligible[randIdx];
      }
    }

    const randIdx = Math.floor(Math.random() * eligibleCards.length);
    return eligibleCards[randIdx];
  }

  public playerDiscardCard(seat: number, card: ICard): boolean {
    if (seat !== this.activeSeat || this.turnPhase !== 'DISCARDING') {
      return false;
    }

    const player = this.players[seat];

    if (card.isEaten) {
      this.log(`Không được đánh lá bài đã ăn!`);
      return false;
    }

    const index = player.hand.findIndex((c) => areCardsEqual(c, card));
    if (index === -1) return false;

    player.hand.splice(index, 1);
    player.discardedCards.push(card);

    const isChot = this.roundNumber === 4;
    this.lastDiscardedCard = card;
    this.lastDiscarderSeat = seat;

    this.notifyDiscardEffect({ discarderSeat: seat, card });
    this.log(`${player.name} đánh ${isChot ? 'CHỐT ' : ''}quân ${card.rank}-${card.suit}.`);

    // Kiểm tra Ù sau khi đánh
    if (player.hasLaidPhoms && player.hand.length === 0) {
      player.isU = true;
      player.uType = 'U_THUONG';
      this.log(`★ ${player.name} Ù! Đánh hết rác!`);
      this.finishGame();
      return true;
    }

    this.advanceTurn();
    return true;
  }

  private advanceTurn(): void {
    const nextSeat = (this.activeSeat + 1) % 4;

    // Kiểm tra kết thúc ván:
    // Cả 4 người đều đã đánh đủ 4 lá bài VÀ không còn lượt tái nào, HOẶC hết nọc
    const allFinished4Rounds = this.players.every((p) => p.discardedCards.length >= 4);
    if (allFinished4Rounds || this.stock.length === 0) {
      this.finishGame();
      return;
    }

    this.activeSeat = nextSeat;
    this.roundNumber = Math.min(4, this.players[this.dealerSeat].discardedCards.length + 1);

    this.turnPhase = 'WAITING_FOR_ACTION';
    this.notifyStateUpdate();

    if (this.players[this.activeSeat].isBot) {
      this.scheduleBotTurn();
    }
  }

  private scheduleBotTurn(): void {
    if (this.botTimer) clearTimeout(this.botTimer);

    const delay =
      GAME_CONFIG.BOT_THINKING_MIN_MS +
      Math.random() * (GAME_CONFIG.BOT_THINKING_MAX_MS - GAME_CONFIG.BOT_THINKING_MIN_MS);

    this.botTimer = setTimeout(() => {
      const bot = this.players[this.activeSeat];
      if (!bot.isBot || this.isGameOver) return;

      if (this.turnPhase === 'WAITING_FOR_ACTION') {
        let ate = false;
        if (this.lastDiscardedCard) {
          const eatDecision = BotAI.shouldEatCard(bot.hand, bot.eatenCards, this.lastDiscardedCard);
          if (eatDecision.shouldEat) {
            ate = this.playerEatCard(bot.seat);
          }
        }
        if (!ate) {
          this.playerDrawCard(bot.seat);
        }
      } else if (this.turnPhase === 'LAYING_PHOMS') {
        this.playerLayPhoms(bot.seat);
      } else if (this.turnPhase === 'SENDING_CARDS') {
        this.playerSendCards(bot.seat);
      } else if (this.turnPhase === 'DISCARDING') {
        const allDiscarded: ICard[] = [];
        for (const p of this.players) allDiscarded.push(...p.discardedCards);

        const isChot = this.roundNumber === 4;
        const cardToDiscard = BotAI.chooseCardToDiscard(
          bot.hand,
          bot.eatenCards,
          isChot,
          allDiscarded
        );
        this.playerDiscardCard(bot.seat, cardToDiscard);
      }
    }, delay);
  }

  public finishGame(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.turnPhase = 'ROUND_ENDED';

    for (const p of this.players) {
      if (!p.hasLaidPhoms && !p.isU) {
        const best = findBestPhomCombination(p.hand, p.eatenCards, p.seat);
        if (best.phoms.length > 0) {
          p.laidPhoms.push(...best.phoms);
          p.hasLaidPhoms = true;
          const phomIds = new Set<number>();
          for (const ph of best.phoms) for (const c of ph.cards) phomIds.add(c.id);
          p.hand = p.hand.filter((c) => !phomIds.has(c.id));
        } else {
          p.isMom = true;
          p.hasLaidPhoms = true;
        }
      }

      if (p.isU) {
        p.score = 0;
      } else if (p.isMom) {
        p.score = 999;
      } else {
        p.score = calculateDeadwoodScore(p.hand);
      }
    }

    const rankResult = rankPlayers(this.players);
    for (const s of rankResult.standings) {
      this.players[s.seat].finalRank = s.finalRank;
    }

    const penaltySummary = this.penaltyManager.calculateFinalPayout(
      this.players,
      rankResult.standings,
      rankResult.isU,
      rankResult.winnerSeat
    );

    for (let i = 0; i < 4; i++) {
      this.players[i].totalCoinChange = penaltySummary.coinChanges[i];
      this.players[i].coins += penaltySummary.coinChanges[i];
      if (this.players[i].coins < 0) this.players[i].coins = 0;
    }

    const playerChange = penaltySummary.coinChanges[0];
    const isPlayerWinner = this.players[0].finalRank === 1;
    EconomyService.getInstance().recordGameResult(
      isPlayerWinner,
      this.players[0].isU,
      playerChange
    );

    const standingsForUI = this.players.map((p) => {
      return {
        seat: p.seat,
        name: p.name,
        finalRank: p.finalRank,
        score: p.score,
        isMom: p.isMom,
        isU: p.isU,
        deadwood: p.hand,
        coinChange: p.totalCoinChange,
      };
    });

    standingsForUI.sort((a, b) => a.finalRank - b.finalRank);

    const finalRoundResult: IRoundResult = {
      winnerSeat: rankResult.winnerSeat,
      isU: rankResult.isU,
      uType: rankResult.uType,
      standings: standingsForUI,
    };

    for (const d of penaltySummary.details) {
      this.log(d);
    }

    this.notifyStateUpdate();
    for (const l of this.listeners) l.onGameOver(finalRoundResult);
  }
}

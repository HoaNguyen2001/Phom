import { IPlayer } from './Types';

export interface IEatRecord {
  eaterSeat: number;
  feederSeat: number;
  isChot: boolean;
  eatIndex: number; // 1: Cây thứ 1, 2: Cây thứ 2, 3: Cây thứ 3
  amount: number;
}

export interface IPenaltySummary {
  coinChanges: number[]; // Số xu thay đổi cho từng ghế [seat 0, 1, 2, 3]
  denSeat?: number;      // Ghế phải đền cả làng (nếu có)
  denReason?: string;    // Lý do đền (Ăn 3 cây đền làng / Ăn chốt đền)
  details: string[];
}

export class PenaltyManager {
  private eatRecords: IEatRecord[] = [];
  private betAmount: number;

  constructor(betAmount: number) {
    this.betAmount = betAmount;
  }

  public setBetAmount(bet: number) {
    this.betAmount = bet;
  }

  /**
   * Ghi nhận một pha ăn bài và tính cước phạt ngay lập tức
   */
  public recordEat(
    eaterSeat: number,
    feederSeat: number,
    isChot: boolean,
    playerEatenCount: number
  ): { penaltyAmount: number; description: string } {
    let multiplier = 1;

    if (isChot) {
      multiplier = 4; // Bị ăn cây chốt phạt gấp 4 lần cược!
    } else {
      multiplier = playerEatenCount; // Cây 1: 1 cược, Cây 2: 2 cược, Cây 3: 3 cược
    }

    const penaltyAmount = multiplier * this.betAmount;

    this.eatRecords.push({
      eaterSeat,
      feederSeat,
      isChot,
      eatIndex: playerEatenCount,
      amount: penaltyAmount,
    });

    const desc = isChot
      ? `Ăn cây CHỐT! Ghế ${feederSeat} bị phạt ${penaltyAmount.toLocaleString()} Xu (x4 cược)`
      : `Ăn cây thứ ${playerEatenCount}! Ghế ${feederSeat} bị phạt ${penaltyAmount.toLocaleString()} Xu (x${multiplier} cược)`;

    return { penaltyAmount, description: desc };
  }

  /**
   * Kiểm tra điều kiện Ù đền làng:
   * 1. Có ai cho người Ù ăn liên tiếp 3 cây không?
   * 2. Hoặc người Ù ăn cây chốt của người cửa trên?
   */
  public checkDenLang(winnerSeat: number, isU: boolean): { isDen: boolean; denSeat?: number; reason?: string } {
    if (!isU) return { isDen: false };

    // Lọc các lần người chiến thắng ăn bài
    const winnerEats = this.eatRecords.filter((r) => r.eaterSeat === winnerSeat);

    // 1. Kiểm tra ăn 3 cây từ cùng 1 người
    const eatsFromFeeder = new Map<number, number>();
    for (const record of winnerEats) {
      const count = (eatsFromFeeder.get(record.feederSeat) || 0) + 1;
      eatsFromFeeder.set(record.feederSeat, count);
      if (count >= 3) {
        return {
          isDen: true,
          denSeat: record.feederSeat,
          reason: `Cho ăn liên tiếp 3 cây dẫn đến Ù! Đền cả làng!`,
        };
      }
    }

    // 2. Kiểm tra ăn chốt dẫn đến Ù
    const chotEat = winnerEats.find((r) => r.isChot);
    if (chotEat) {
      return {
        isDen: true,
        denSeat: chotEat.feederSeat,
        reason: `Bị ăn cây chốt dẫn đến Ù! Đền cả làng!`,
      };
    }

    return { isDen: false };
  }

  /**
   * Tính toán kết toán Xu cuối ván (kết hợp cả tiền ăn cây + tiền thắng thua chung cuộc)
   */
  public calculateFinalPayout(
    players: IPlayer[],
    standings: { seat: number; finalRank: number; isMom: boolean; isU: boolean }[],
    isU: boolean,
    winnerSeat: number
  ): IPenaltySummary {
    const coinChanges = [0, 0, 0, 0];
    const details: string[] = [];

    // 1. Áp dụng tiền ăn bài trong ván
    for (const record of this.eatRecords) {
      coinChanges[record.eaterSeat] += record.amount;
      coinChanges[record.feederSeat] -= record.amount;
    }

    // 2. Kết toán thứ hạng hoặc Ù
    if (isU) {
      const denCheck = this.checkDenLang(winnerSeat, isU);
      const uRewardPerPlayer = 5 * this.betAmount; // Ù ăn mỗi nhà 5 cược
      const totalUReward = uRewardPerPlayer * 3;

      if (denCheck.isDen && denCheck.denSeat !== undefined) {
        // Đền cả làng: Người đền trả toàn bộ cho người Ù!
        coinChanges[winnerSeat] += totalUReward;
        coinChanges[denCheck.denSeat] -= totalUReward;
        details.push(
          `Ghế ${denCheck.denSeat} ${denCheck.reason} Phạt đền ${totalUReward.toLocaleString()} Xu cho người Ù.`
        );
        return {
          coinChanges,
          denSeat: denCheck.denSeat,
          denReason: denCheck.reason,
          details,
        };
      } else {
        // Bình thường: mỗi người thua trả 5 cược
        for (const p of players) {
          if (p.seat === winnerSeat) {
            coinChanges[p.seat] += totalUReward;
          } else {
            coinChanges[p.seat] -= uRewardPerPlayer;
          }
        }
        details.push(`Ù thường! Người thắng nhận ${totalUReward.toLocaleString()} Xu (+5 cược mỗi nhà).`);
      }
    } else {
      // Kết toán điểm thường (Nhất, Nhì, Ba, Bét / Móm)
      let firstSeat = -1;
      let totalWinnerGain = 0;

      for (const item of standings) {
        if (item.finalRank === 1) {
          firstSeat = item.seat;
        } else if (item.finalRank === 2) {
          // Nhì trả 1 cược
          const loss = 1 * this.betAmount;
          coinChanges[item.seat] -= loss;
          totalWinnerGain += loss;
        } else if (item.finalRank === 3) {
          // Ba trả 2 cược
          const loss = 2 * this.betAmount;
          coinChanges[item.seat] -= loss;
          totalWinnerGain += loss;
        } else if (item.finalRank === 4) {
          // Bét trả 3 cược, nếu Móm trả 4 cược
          const loss = (item.isMom ? 4 : 3) * this.betAmount;
          coinChanges[item.seat] -= loss;
          totalWinnerGain += loss;
          if (item.isMom) {
            details.push(`Ghế ${item.seat} bị MÓM (cháy) phạt 4 cược!`);
          }
        }
      }

      if (firstSeat !== -1) {
        coinChanges[firstSeat] += totalWinnerGain;
        details.push(`Ghế ${firstSeat} về Nhất nhận tổng cộng +${totalWinnerGain.toLocaleString()} Xu.`);
      }
    }

    return {
      coinChanges,
      details,
    };
  }

  public reset(): void {
    this.eatRecords = [];
  }
}

import { GAME_CONFIG } from '../config/GameConfig';

const STORAGE_KEY_COINS = 'TALA_USER_COINS';
const STORAGE_KEY_STATS = 'TALA_USER_STATS';

export interface IUserStats {
  gamesPlayed: number;
  gamesWon: number;
  uCount: number;
  totalEarnings: number;
}

export class EconomyService {
  private static instance: EconomyService;
  private coins: number;
  private currentBet: number = 1000;
  private stats: IUserStats;

  private constructor() {
    let savedCoins: string | null = null;
    let savedStats: string | null = null;

    if (typeof localStorage !== 'undefined') {
      try {
        savedCoins = localStorage.getItem(STORAGE_KEY_COINS);
        savedStats = localStorage.getItem(STORAGE_KEY_STATS);
      } catch {
        // Safe fallback
      }
    }

    this.coins = savedCoins !== null ? parseInt(savedCoins, 10) : GAME_CONFIG.STARTING_COINS;

    if (savedStats) {
      try {
        this.stats = JSON.parse(savedStats);
      } catch {
        this.stats = { gamesPlayed: 0, gamesWon: 0, uCount: 0, totalEarnings: 0 };
      }
    } else {
      this.stats = { gamesPlayed: 0, gamesWon: 0, uCount: 0, totalEarnings: 0 };
    }
  }

  public static getInstance(): EconomyService {
    if (!EconomyService.instance) {
      EconomyService.instance = new EconomyService();
    }
    return EconomyService.instance;
  }

  public getCoins(): number {
    return this.coins;
  }

  public addCoins(amount: number): number {
    this.coins += amount;
    if (this.coins < 0) this.coins = 0;
    this.save();
    return this.coins;
  }

  public deductCoins(amount: number): boolean {
    if (this.coins >= amount) {
      this.coins -= amount;
      this.save();
      return true;
    }
    return false;
  }

  public canAffordBet(bet = this.currentBet): boolean {
    return this.coins >= bet * 4;
  }

  public getCurrentBet(): number {
    return this.currentBet;
  }

  public setCurrentBet(bet: number) {
    this.currentBet = bet;
  }

  public recordGameResult(isWinner: boolean, isU: boolean, coinChange: number) {
    this.stats.gamesPlayed++;
    if (isWinner) this.stats.gamesWon++;
    if (isU) this.stats.uCount++;
    this.stats.totalEarnings += coinChange;
    this.addCoins(coinChange);
    this.save();
  }

  public getStats(): IUserStats {
    return { ...this.stats };
  }

  private save() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_COINS, this.coins.toString());
        localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(this.stats));
      } catch {
        // Ignore
      }
    }
  }
}

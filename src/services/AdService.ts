import { EconomyService } from './EconomyService';
import { FBInstantBridge } from './FBInstantBridge';

export interface IAdCallbacks {
  onAdStarted?: () => void;
  onAdProgress?: (secondsLeft: number) => void;
  onAdCompleted?: (rewardCoins: number) => void;
  onAdFailed?: (errorMsg: string) => void;
}

export class AdService {
  public static readonly REWARD_AMOUNT = 20000;

  /**
   * Xem video quảng cáo nhận thưởng (+20,000 Xu)
   */
  public static async showRewardedVideo(callbacks: IAdCallbacks): Promise<void> {
    if (FBInstantBridge.isAvailable()) {
      try {
        callbacks.onAdStarted?.();
        // Gọi API quảng cáo có thưởng chính thức của Facebook Instant Games
        const rewardedVideo = await (window as any).FBInstant.getRewardedVideoAsync(
          'YOUR_PLACEMENT_ID'
        );
        await rewardedVideo.loadAsync();
        await rewardedVideo.showAsync();

        // Xem thành công:
        EconomyService.getInstance().addCoins(this.REWARD_AMOUNT);
        callbacks.onAdCompleted?.(this.REWARD_AMOUNT);
        return;
      } catch (err: any) {
        console.warn('[AdService] Facebook Ad error:', err);
        callbacks.onAdFailed?.(err?.message || 'Không thể tải quảng cáo Facebook');
        return;
      }
    }

    // Chế độ Giả lập Quảng Cáo (Local Test Mode)
    callbacks.onAdStarted?.();
    let timeLeft = 5;

    callbacks.onAdProgress?.(timeLeft);
    const interval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        callbacks.onAdProgress?.(timeLeft);
      } else {
        clearInterval(interval);
        EconomyService.getInstance().addCoins(this.REWARD_AMOUNT);
        callbacks.onAdCompleted?.(this.REWARD_AMOUNT);
      }
    }, 1000);
  }
}

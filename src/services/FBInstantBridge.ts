// Interface định nghĩa tối giản cho Facebook Instant Games SDK
declare global {
  interface Window {
    FBInstant?: any;
  }
}

export class FBInstantBridge {
  private static isInitialized = false;

  /**
   * Chỉ coi là môi trường Facebook thật nếu có FBInstant VÀ KHÔNG PHẢI chạy localhost/file
   */
  public static isAvailable(): boolean {
    if (typeof window === 'undefined' || typeof window.FBInstant === 'undefined') {
      return false;
    }
    const hostname = window.location.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      window.location.protocol === 'file:'
    ) {
      return false;
    }
    return true;
  }

  public static async init(): Promise<void> {
    if (!this.isAvailable()) {
      console.log('[FBInstantBridge] Đang chạy chế độ Local Test (Chưa kết nối Facebook)');
      return;
    }

    try {
      // Timeout an toàn 1.5 giây nếu FB SDK không phản hồi
      await Promise.race([
        window.FBInstant.initializeAsync(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('FB Instant Timeout')), 1500)
        ),
      ]);
      this.isInitialized = true;
      console.log('[FBInstantBridge] Đã khởi tạo Facebook Instant Games SDK thành công');
    } catch (err) {
      console.warn('[FBInstantBridge] Bỏ qua khởi tạo FBInstant SDK:', err);
    }
  }

  public static async startGame(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await Promise.race([
        window.FBInstant.startGameAsync(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('FB Start Timeout')), 1500)
        ),
      ]);
      console.log('[FBInstantBridge] Đã bắt đầu game trên Facebook');
    } catch (err) {
      console.warn('[FBInstantBridge] startGameAsync warning:', err);
    }
  }

  public static getPlayerName(): string {
    if (this.isAvailable()) {
      try {
        return window.FBInstant.player.getName() || 'Bạn (Bạn chơi)';
      } catch {
        return 'Bạn (Bạn chơi)';
      }
    }
    return 'Bạn (Cơ trưởng)';
  }

  public static getPlayerPhoto(): string {
    if (this.isAvailable()) {
      try {
        return window.FBInstant.player.getPhoto() || '';
      } catch {
        return '';
      }
    }
    return '';
  }

  /**
   * Mời bạn bè Facebook vào chơi cùng (Context Choose / Messenger)
   */
  public static async inviteFriends(roomCode = 'ROOM_8888'): Promise<boolean> {
    if (!this.isAvailable()) {
      alert(
        `[Mời Bạn Bè - Mock Local]: Đã tạo mã phòng chơi: ${roomCode}.\nTrên Facebook tính năng này sẽ mở hộp thoại gửi lời mời Messenger đến bạn bè.`
      );
      return true;
    }

    try {
      await window.FBInstant.context.chooseAsync({
        minSize: 2,
        maxSize: 4,
      });

      await window.FBInstant.updateAsync({
        action: 'CUSTOM',
        cta: 'Chơi ngay',
        text: {
          default: 'Vào bàn chơi Tá Lả Miền Bắc ngay cùng tôi nhé!',
          localizations: {
            vi_VN: 'Vào bàn chơi Tá Lả Miền Bắc ngay cùng tôi nhé!',
          },
        },
        template: 'play_invite',
        data: { roomCode },
        strategy: 'IMMEDIATE',
        notification: 'NO_PUSH',
      });

      return true;
    } catch (err) {
      console.warn('[FBInstantBridge] Lỗi mời bạn bè:', err);
      return false;
    }
  }

  /**
   * Chia sẻ ván bài / thành tích lên Bảng tin Facebook
   */
  public static async shareGame(scoreText: string): Promise<boolean> {
    if (!this.isAvailable()) {
      alert(`[Chia Sẻ Facebook - Mock Local]: "${scoreText}"`);
      return true;
    }

    try {
      await window.FBInstant.shareAsync({
        intent: 'SHARE',
        text: scoreText,
        data: { source: 'tala_share' },
      });
      return true;
    } catch (err) {
      console.warn('[FBInstantBridge] Lỗi shareAsync:', err);
      return false;
    }
  }
}

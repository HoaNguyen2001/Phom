import Phaser from 'phaser';
import { CardGraphics } from '../assets/CardGraphics';
import { FBInstantBridge } from '../services/FBInstantBridge';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  public create(): void {
    // 1. Tạo toàn bộ 52 lá bài vector & icon trước tiên
    CardGraphics.generateTextures(this);

    // 2. Khởi tạo FB SDK ở chế độ nền (hoàn toàn non-blocking, không làm đơ game)
    FBInstantBridge.init()
      .then(() => {
        return FBInstantBridge.startGame();
      })
      .catch((err) => {
        console.warn('FB Instant background init skipped:', err);
      });

    // 3. Chuyển ngay lập tức sang màn hình Sảnh (Lobby)
    this.scene.start('LobbyScene');
  }
}

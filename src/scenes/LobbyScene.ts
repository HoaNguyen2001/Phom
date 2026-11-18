import Phaser from 'phaser';
import { SoundManager } from '../assets/SoundManager';
import { AdService } from '../services/AdService';
import { EconomyService } from '../services/EconomyService';
import { FBInstantBridge } from '../services/FBInstantBridge';

export class LobbyScene extends Phaser.Scene {
  private coinText!: Phaser.GameObjects.Text;
  private selectedBet: number = 1000;
  private betButtons: Phaser.GameObjects.Container[] = [];
  private adModalContainer?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  public create(): void {
    const { width, height } = this.scale;

    // Nền bàn nỉ xanh đậm sang trọng
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a2e1d);

    // Họa tiết viền vàng casino
    const border = this.add.graphics();
    border.lineStyle(3, 0xd4af37, 0.4);
    border.strokeRect(20, 20, width - 40, height - 40);

    // Tiêu đề Game
    this.add
      .text(width / 2, 75, 'TÁ LẢ MIỀN BẮC', {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '44px',
        fontStyle: 'bold',
        color: '#f1c40f',
        stroke: '#000000',
        strokeThickness: 6,
        shadow: { offsetX: 0, offsetY: 4, color: '#000000', blur: 10, fill: true },
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 120, 'Phỏm Truyền Thống - Sẵn Sàng Facebook Instant Games', {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '18px',
        color: '#a3e4d7',
      })
      .setOrigin(0.5);

    // Hộp hiển thị Xu ở góc trên bên phải
    this.createCoinBadge(width - 170, 75);

    // Nút Bật/Tắt Âm Thanh ở góc trên bên trái
    this.createSoundButton(70, 75);

    // Chọn mức cược
    this.add
      .text(width / 2, 175, 'CHỌN MỨC CƯỢC BÀN CHƠI', {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const betLevels = [
      { bet: 1000, label: 'TẬP SỰ', minCoin: 4000 },
      { bet: 5000, label: 'CAO THỦ', minCoin: 20000 },
      { bet: 10000, label: 'ĐẠI GIA', minCoin: 40000 },
    ];

    const startX = width / 2 - 260;
    betLevels.forEach((level, idx) => {
      const btn = this.createBetCard(startX + idx * 260, 270, level.bet, level.label, level.minCoin);
      this.betButtons.push(btn);
    });

    this.updateBetSelectionVisuals();

    // Nút chính: VÀO BÀN CHƠI
    this.createButton(
      width / 2,
      410,
      'VÀO BÀN CHƠI NGAY',
      0x27ae60,
      0x2ecc71,
      320,
      60,
      () => this.onPlayClick()
    );

    // Nút phụ: XEM QUẢNG CÁO NHẬN 20,000 XU
    this.createButton(
      width / 2 - 180,
      500,
      '🎬 XEM QUẢNG CÁO (+20,000 XU)',
      0x8e44ad,
      0x9b59b6,
      320,
      50,
      () => this.openAdModal()
    );

    // Nút phụ: MỜI BẠN BÈ FACEBOOK
    this.createButton(
      width / 2 + 180,
      500,
      '👥 MỜI BẠN BÈ FACEBOOK',
      0x2980b9,
      0x3498db,
      320,
      50,
      () => {
        SoundManager.getInstance().playCoin();
        FBInstantBridge.inviteFriends('ROOM_' + Math.floor(1000 + Math.random() * 9000));
      }
    );

    // Nút: LUẬT TÁ LẢ MIỀN BẮC
    this.createButton(
      width / 2,
      580,
      '📜 XEM LUẬT TÁ LẢ MIỀN BẮC',
      0x34495e,
      0x4a6572,
      280,
      44,
      () => this.showRulesModal()
    );

    // Thống kê người chơi ở dưới cùng
    const stats = EconomyService.getInstance().getStats();
    const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
    this.add
      .text(
        width / 2,
        655,
        `Trận đã chơi: ${stats.gamesPlayed} | Thắng: ${stats.gamesWon} (${winRate}%) | Thắng Ù: ${stats.uCount}`,
        {
          fontFamily: '"Segoe UI", Arial, sans-serif',
          fontSize: '15px',
          color: '#bdc3c7',
        }
      )
      .setOrigin(0.5);
  }

  private createCoinBadge(x: number, y: number): void {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(-100, -25, 200, 50, 25);
    bg.lineStyle(2, 0xf1c40f, 0.8);
    bg.strokeRoundedRect(-100, -25, 200, 50, 25);
    container.add(bg);

    const icon = this.add.image(-70, 0, 'coin_icon').setDisplaySize(34, 34);
    container.add(icon);

    const coins = EconomyService.getInstance().getCoins();
    this.coinText = this.add
      .text(-40, 0, coins.toLocaleString(), {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#f1c40f',
      })
      .setOrigin(0, 0.5);
    container.add(this.coinText);
  }

  private updateCoinsDisplay(): void {
    const coins = EconomyService.getInstance().getCoins();
    this.coinText.setText(coins.toLocaleString());
  }

  private createSoundButton(x: number, y: number): void {
    const container = this.add.container(x, y);
    const bg = this.add.circle(0, 0, 24, 0x1c313a);
    bg.setStrokeStyle(2, 0xd4af37);
    container.add(bg);

    const isMuted = SoundManager.getInstance().getMuted();
    const label = this.add
      .text(0, 0, isMuted ? '🔇' : '🔊', { fontSize: '22px' })
      .setOrigin(0.5);
    container.add(label);

    container.setSize(48, 48);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => {
      const muted = SoundManager.getInstance().toggleMute();
      label.setText(muted ? '🔇' : '🔊');
    });
  }

  private createBetCard(
    x: number,
    y: number,
    bet: number,
    label: string,
    minCoin: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    container.add(bg);
    (container as any).bgGraphic = bg;
    (container as any).betValue = bet;

    const title = this.add
      .text(0, -45, label, {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    container.add(title);

    const amount = this.add
      .text(0, -10, `${bet.toLocaleString()} Xu`, {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#f1c40f',
      })
      .setOrigin(0.5);
    container.add(amount);

    const sub = this.add
      .text(0, 30, `Yêu cầu >= ${minCoin.toLocaleString()} Xu`, {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '13px',
        color: '#bdc3c7',
      })
      .setOrigin(0.5);
    container.add(sub);

    container.setSize(220, 130);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerdown', () => {
      SoundManager.getInstance().playDiscard();
      this.selectedBet = bet;
      this.updateBetSelectionVisuals();
    });

    return container;
  }

  private updateBetSelectionVisuals(): void {
    for (const btn of this.betButtons) {
      const bg = (btn as any).bgGraphic as Phaser.GameObjects.Graphics;
      const betVal = (btn as any).betValue as number;
      const isSelected = betVal === this.selectedBet;

      bg.clear();
      if (isSelected) {
        bg.fillStyle(0x1e8449, 0.9);
        bg.fillRoundedRect(-110, -65, 220, 130, 14);
        bg.lineStyle(4, 0xf1c40f, 1);
        bg.strokeRoundedRect(-110, -65, 220, 130, 14);
      } else {
        bg.fillStyle(0x145a32, 0.6);
        bg.fillRoundedRect(-110, -65, 220, 130, 14);
        bg.lineStyle(2, 0x52be80, 0.4);
        bg.strokeRoundedRect(-110, -65, 220, 130, 14);
      }
    }
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    colorNormal: number,
    colorHover: number,
    width: number,
    height: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(colorNormal, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    bg.lineStyle(2, 0xffffff, 0.4);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    container.add(bg);

    const label = this.add
      .text(0, 0, text, {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    container.add(label);

    container.setSize(width, height);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(colorHover, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
      bg.lineStyle(2, 0xffffff, 0.8);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(colorNormal, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
      bg.lineStyle(2, 0xffffff, 0.4);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    });

    container.on('pointerdown', onClick);
    return container;
  }

  private onPlayClick(): void {
    const economy = EconomyService.getInstance();
    economy.setCurrentBet(this.selectedBet);

    if (!economy.canAffordBet(this.selectedBet)) {
      SoundManager.getInstance().playError();
      this.showOutOfCoinsAlert();
      return;
    }

    SoundManager.getInstance().playDeal();
    this.scene.start('TableScene', { betAmount: this.selectedBet });
  }

  private showOutOfCoinsAlert(): void {
    const { width, height } = this.scale;
    const modal = this.add.container(width / 2, height / 2);

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
    overlay.setInteractive();
    modal.add(overlay);

    const box = this.add.graphics();
    box.fillStyle(0x1b2631, 1);
    box.fillRoundedRect(-220, -130, 440, 260, 16);
    box.lineStyle(3, 0xe74c3c, 1);
    box.strokeRoundedRect(-220, -130, 440, 260, 16);
    modal.add(box);

    const title = this.add
      .text(0, -90, 'HẾT XU VÀO BÀN!', {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#e74c3c',
      })
      .setOrigin(0.5);
    modal.add(title);

    const desc = this.add
      .text(
        0,
        -35,
        `Bạn không đủ Xu để vào bàn cược này.\nXem ngay một đoạn video quảng cáo ngắn\nđể nhận ngay +20,000 Xu miễn phí!`,
        {
          fontFamily: '"Segoe UI", Arial, sans-serif',
          fontSize: '16px',
          color: '#ecf0f1',
          align: 'center',
          lineSpacing: 6,
        }
      )
      .setOrigin(0.5);
    modal.add(desc);

    // Nút Xem Ads
    const adBtn = this.createButton(
      0,
      45,
      '🎬 XEM QUẢNG CÁO (+20,000 XU)',
      0x8e44ad,
      0x9b59b6,
      300,
      48,
      () => {
        modal.destroy();
        this.openAdModal();
      }
    );
    modal.add(adBtn);

    // Nút Đóng
    const closeBtn = this.createButton(0, 100, 'Đóng', 0x7f8c8d, 0x95a5a6, 120, 36, () => {
      modal.destroy();
    });
    modal.add(closeBtn);
  }

  public openAdModal(): void {
    if (this.adModalContainer) {
      this.adModalContainer.destroy();
    }

    const { width, height } = this.scale;
    const modal = this.add.container(width / 2, height / 2);
    this.adModalContainer = modal;

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85);
    overlay.setInteractive();
    modal.add(overlay);

    const box = this.add.graphics();
    box.fillStyle(0x141f2d, 1);
    box.fillRoundedRect(-240, -160, 480, 320, 16);
    box.lineStyle(3, 0xf1c40f, 1);
    box.strokeRoundedRect(-240, -160, 480, 320, 16);
    modal.add(box);

    const title = this.add
      .text(0, -120, 'ĐANG XEM QUẢNG CÁO', {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#f1c40f',
      })
      .setOrigin(0.5);
    modal.add(title);

    // Video Player Frame giả lập
    const videoFrame = this.add.graphics();
    videoFrame.fillStyle(0x000000, 1);
    videoFrame.fillRoundedRect(-180, -85, 360, 130, 8);
    videoFrame.lineStyle(2, 0x34495e);
    videoFrame.strokeRoundedRect(-180, -85, 360, 130, 8);
    modal.add(videoFrame);

    const adIcon = this.add
      .text(0, -30, '📺\nFacebook Rewarded Video Ad', {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '18px',
        color: '#7f8c8d',
        align: 'center',
      })
      .setOrigin(0.5);
    modal.add(adIcon);

    const timerText = this.add
      .text(0, 70, 'Quảng cáo kết thúc sau: 5 giây', {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '16px',
        color: '#ecf0f1',
      })
      .setOrigin(0.5);
    modal.add(timerText);

    // Bắt đầu chạy quảng cáo
    AdService.showRewardedVideo({
      onAdProgress: (secondsLeft) => {
        timerText.setText(`Quảng cáo kết thúc sau: ${secondsLeft} giây`);
      },
      onAdCompleted: (rewardCoins) => {
        SoundManager.getInstance().playWin();
        timerText.setText(`🎉 Chúc mừng! Bạn nhận được +${rewardCoins.toLocaleString()} Xu!`);
        timerText.setColor('#2ecc71');

        const okBtn = this.createButton(
          0,
          115,
          'NHẬN THƯỞNG & ĐÓNG',
          0x27ae60,
          0x2ecc71,
          240,
          44,
          () => {
            modal.destroy();
            this.updateCoinsDisplay();
          }
        );
        modal.add(okBtn);
      },
      onAdFailed: (msg) => {
        timerText.setText(msg);
        timerText.setColor('#e74c3c');
      },
    });
  }

  private showRulesModal(): void {
    const { width, height } = this.scale;
    const modal = this.add.container(width / 2, height / 2);

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8);
    overlay.setInteractive();
    modal.add(overlay);

    const box = this.add.graphics();
    box.fillStyle(0x1a252f, 1);
    box.fillRoundedRect(-300, -220, 600, 440, 16);
    box.lineStyle(3, 0x3498db, 1);
    box.strokeRoundedRect(-300, -220, 600, 440, 16);
    modal.add(box);

    const title = this.add
      .text(0, -185, 'LUẬT CHƠI TÁ LẢ MIỀN BẮC', {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#3498db',
      })
      .setOrigin(0.5);
    modal.add(title);

    const rulesText = [
      '• Bộ bài 52 lá, 4 người chơi. Người đi đầu 10 lá, 3 người sau 9 lá.',
      '• Phỏm sáp: 3-4 cây cùng số. Phỏm sảnh: 3 cây cùng chất liên tiếp.',
      '• Đến lượt: Ăn bài người cửa trên đánh nếu ghép phỏm, hoặc bốc Nọc.',
      '• Vòng 4 (Vòng Chốt): BẮT BUỘC Hạ Phỏm trước khi đánh cây chốt.',
      '• Gửi bài: Sau khi hạ, được gửi bài rác vào phỏm người đã hạ trước.',
      '• Móm: Không có phỏm nào khi hạ -> Xếp Bét, phạt 4 cược.',
      '• Phạt ăn chốt: Bị ăn cây chốt phạt gấp 4 lần tiền cược!',
      '• Ù đền 3 cây: Để người cửa dưới ăn liên tiếp 3 cây dẫn đến Ù -> Đền cả làng!',
    ].join('\n\n');

    const desc = this.add
      .text(0, -10, rulesText, {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize: '14px',
        color: '#ecf0f1',
        lineSpacing: 4,
        wordWrap: { width: 540 },
      })
      .setOrigin(0.5);
    modal.add(desc);

    const closeBtn = this.createButton(0, 175, 'Đã Hiểu', 0x2980b9, 0x3498db, 180, 42, () => {
      modal.destroy();
    });
    modal.add(closeBtn);
  }
}

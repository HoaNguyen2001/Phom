import Phaser from 'phaser';
import { CARD_HEIGHT, CARD_WIDTH } from '../assets/CardGraphics';
import { SoundManager } from '../assets/SoundManager';
import { GAME_CONFIG } from '../config/GameConfig';
import { IDiscardEffectData, IDrawEffectData, IEatEffectData, LocalGameRoom } from '../controllers/LocalGameRoom';
import { areCardsEqual, sortCardsByRank, sortCardsBySuit } from '../core/Card';
import { canEatCard, findBestPhomCombination } from '../core/PhomDetector';
import { IRoundResult } from '../core/Scoring';
import { canCardBeSentToPhom, findSendableCards } from '../core/SendCardDetector';
import { ICard, IPhom, IPlayer } from '../core/Types';
import { AdService } from '../services/AdService';
import { EconomyService } from '../services/EconomyService';

export class TableScene extends Phaser.Scene {
  private room!: LocalGameRoom;
  private betAmount: number = 1000;

  // UI Containers & Elements
  private playerCardObjects: Phaser.GameObjects.Container[] = [];
  private selectedCard: ICard | null = null;
  private sortMode: 'PHOM_LEFT' | 'RANK' | 'SUIT' | 'MANUAL' = 'PHOM_LEFT';
  private isDraggingCard: boolean = false;

  // Action Buttons
  private btnEat!: Phaser.GameObjects.Container;
  private btnDraw!: Phaser.GameObjects.Container;
  private btnDiscard!: Phaser.GameObjects.Container;
  private btnLayPhom!: Phaser.GameObjects.Container;
  private btnSend!: Phaser.GameObjects.Container;
  private btnSkipSend!: Phaser.GameObjects.Container;
  private btnSort!: Phaser.GameObjects.Container;

  // Turn Countdown Timer
  private timerSecondsLeft: number = GAME_CONFIG.TURN_TIMEOUT_SECONDS;
  private timerCont!: Phaser.GameObjects.Container;
  private timerText!: Phaser.GameObjects.Text;
  private timerCircle!: Phaser.GameObjects.Graphics;
  private turnTimerEvent?: Phaser.Time.TimerEvent;

  // Seats Display
  private seatContainers: Phaser.GameObjects.Container[] = [];
  private discardContainers: Phaser.GameObjects.Container[] = [];
  private laidPhomContainers: Phaser.GameObjects.Container[] = [];
  private stockContainer!: Phaser.GameObjects.Container;
  private stockCountText!: Phaser.GameObjects.Text;
  private roundBadgeText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private turnIndicatorGraphics!: Phaser.GameObjects.Graphics;

  // Modals
  private gameOverModal?: Phaser.GameObjects.Container;
  private adModalContainer?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'TableScene' });
  }

  public init(data: { betAmount?: number }): void {
    this.betAmount = data.betAmount || 1000;
  }

  public create(): void {
    const { width, height } = this.scale;

    this.drawTableFelt(width, height);

    this.room = new LocalGameRoom(this.betAmount);
    this.room.addListener({
      onStateUpdate: () => {
        this.resetTurnTimer();
        this.renderRoomState();
      },
      onLogMessage: (msg) => this.showToast(msg),
      onGameOver: (result) => {
        this.stopTurnTimer();
        this.showGameOverModal(result);
      },
      onCardEatEffect: (data) => this.handleCardEatEffect(data),
      onCardDiscardEffect: (data) => this.handleCardDiscardEffect(data),
      onCardDrawEffect: (data) => this.handleCardDrawEffect(data),
    });

    this.createTopBar(width);
    this.createStockPile(width / 2, height / 2 - 40);
    this.createPlayerSeats(width, height);
    this.createActionButtonsAndTimer(width, height);

    this.startTurnTimer();
    SoundManager.getInstance().playDeal();
    this.room.startNewGame(0, this.betAmount);
  }

  private drawTableFelt(width: number, height: number): void {
    this.add.rectangle(width / 2, height / 2, width, height, 0x140c06);

    const felt = this.add.graphics();
    felt.fillStyle(0x0e3a24, 1);
    felt.fillRoundedRect(30, 20, width - 60, height - 40, 50);

    felt.lineStyle(6, 0xd4af37, 0.8);
    felt.strokeRoundedRect(30, 20, width - 60, height - 40, 50);

    felt.lineStyle(2, 0x1e8449, 0.6);
    felt.strokeRoundedRect(60, 45, width - 120, height - 90, 40);

    this.turnIndicatorGraphics = this.add.graphics();
  }

  private createTopBar(width: number): void {
    const backBtn = this.add.container(85, 45);
    const bg = this.add.graphics();
    bg.fillStyle(0x2c3e50, 0.8);
    bg.fillRoundedRect(-50, -18, 100, 36, 18);
    bg.lineStyle(1.5, 0xbdc3c7);
    bg.strokeRoundedRect(-50, -18, 100, 36, 18);
    backBtn.add(bg);

    const backLabel = this.add
      .text(0, 0, '⬅ Rời Bàn', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    backBtn.add(backLabel);

    backBtn.setSize(100, 36);
    backBtn.setInteractive(new Phaser.Geom.Rectangle(-4, -4, 108, 44), Phaser.Geom.Rectangle.Contains);
    if (backBtn.input) backBtn.input.cursor = 'pointer';
    backBtn.on('pointerdown', () => {
      this.stopTurnTimer();
      this.scene.start('LobbyScene');
    });

    const infoBg = this.add.graphics();
    infoBg.fillStyle(0x000000, 0.5);
    infoBg.fillRoundedRect(width / 2 - 170, 28, 340, 36, 18);
    infoBg.lineStyle(1.5, 0xd4af37, 0.6);
    infoBg.strokeRoundedRect(width / 2 - 170, 28, 340, 36, 18);

    this.roundBadgeText = this.add
      .text(width / 2, 46, 'VÒNG 1/4 - CƯỢC 1,000 XU', {
        fontFamily: '"Segoe UI", sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#f1c40f',
      })
      .setOrigin(0.5);

    const soundBtn = this.add.container(width - 170, 45);
    const soundBg = this.add.circle(0, 0, 18, 0x2c3e50);
    soundBg.setStrokeStyle(1.5, 0xd4af37);
    soundBtn.add(soundBg);

    const isMuted = SoundManager.getInstance().getMuted();
    const soundLabel = this.add.text(0, 0, isMuted ? '🔇' : '🔊', { fontSize: '18px' }).setOrigin(0.5);
    soundBtn.add(soundLabel);

    soundBtn.setSize(36, 36);
    soundBtn.setInteractive(new Phaser.Geom.Rectangle(-4, -4, 44, 44), Phaser.Geom.Rectangle.Contains);
    if (soundBtn.input) soundBtn.input.cursor = 'pointer';
    soundBtn.on('pointerdown', () => {
      const muted = SoundManager.getInstance().toggleMute();
      soundLabel.setText(muted ? '🔇' : '🔊');
    });

    const adBtn = this.add.container(width - 85, 45);
    const adBg = this.add.graphics();
    adBg.fillStyle(0x8e44ad, 0.9);
    adBg.fillRoundedRect(-55, -18, 110, 36, 18);
    adBg.lineStyle(1.5, 0xf1c40f);
    adBg.strokeRoundedRect(-55, -18, 110, 36, 18);
    adBtn.add(adBg);

    const adLabel = this.add
      .text(0, 0, '+20K XU 🎬', {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    adBtn.add(adLabel);

    adBtn.setSize(110, 36);
    adBtn.setInteractive(new Phaser.Geom.Rectangle(-4, -4, 118, 44), Phaser.Geom.Rectangle.Contains);
    if (adBtn.input) adBtn.input.cursor = 'pointer';
    adBtn.on('pointerdown', () => this.openAdModal());

    this.toastText = this.add
      .text(width / 2, 85, 'Chào mừng đến với bàn chơi Tá Lả Miền Bắc!', {
        fontFamily: '"Segoe UI", sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#000000bb',
        padding: { left: 14, right: 14, top: 4, bottom: 4 },
      })
      .setOrigin(0.5);
  }

  private createStockPile(x: number, y: number): void {
    this.stockContainer = this.add.container(x, y);

    for (let i = 0; i < 3; i++) {
      const card = this.add.image(i * 2, i * 2, 'card_back').setDisplaySize(65, 95);
      this.stockContainer.add(card);
    }

    const badge = this.add.graphics();
    badge.fillStyle(0x000000, 0.85);
    badge.fillCircle(18, 25, 16);
    badge.lineStyle(2, 0xf1c40f);
    badge.strokeCircle(18, 25, 16);
    this.stockContainer.add(badge);

    this.stockCountText = this.add
      .text(18, 25, '15', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#f1c40f',
      })
      .setOrigin(0.5);
    this.stockContainer.add(this.stockCountText);

    const label = this.add
      .text(0, 58, 'NỌC', {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ecf0f1',
      })
      .setOrigin(0.5);
    this.stockContainer.add(label);

    this.stockContainer.setSize(75, 105);
    this.stockContainer.setInteractive(
      new Phaser.Geom.Rectangle(-4, -4, 83, 113),
      Phaser.Geom.Rectangle.Contains
    );
    if (this.stockContainer.input) this.stockContainer.input.cursor = 'pointer';
    this.stockContainer.on('pointerdown', () => {
      if (this.room.activeSeat === 0 && this.room.turnPhase === 'WAITING_FOR_ACTION') {
        SoundManager.getInstance().playDeal();
        this.room.playerDrawCard(0);
      }
    });
  }

  private createPlayerSeats(width: number, height: number): void {
    const seatConfigs = [
      { x: 170, y: height - 110, align: 'left', discardX: width / 2 - 80, discardY: height / 2 + 50 },
      { x: width - 130, y: height / 2 - 40, align: 'right', discardX: width / 2 + 160, discardY: height / 2 - 40 },
      { x: width / 2, y: 130, align: 'center', discardX: width / 2, discardY: height / 2 - 125 },
      { x: 130, y: height / 2 - 40, align: 'left', discardX: width / 2 - 160, discardY: height / 2 - 40 },
    ];

    seatConfigs.forEach((cfg, idx) => {
      const seatCont = this.add.container(cfg.x, cfg.y);
      this.seatContainers.push(seatCont);

      const discardCont = this.add.container(cfg.discardX, cfg.discardY);
      this.discardContainers.push(discardCont);

      const phomX = idx === 0 ? width / 2 : idx === 1 ? cfg.x - 110 : idx === 3 ? cfg.x + 110 : cfg.x;
      const phomY = idx === 0 ? height - 195 : idx === 2 ? cfg.y + 55 : cfg.y + 60;
      const laidCont = this.add.container(phomX, phomY);
      this.laidPhomContainers.push(laidCont);
    });
  }

  private createActionButtonsAndTimer(width: number, height: number): void {
    const actionY = height - 235;

    // 1. Đồng hồ đếm ngược 15 giây
    this.timerCont = this.add.container(width / 2 - 340, actionY);
    this.timerCont.setDepth(30);
    this.timerCircle = this.add.graphics();
    this.timerCont.add(this.timerCircle);

    this.timerText = this.add
      .text(0, 0, '15s', {
        fontFamily: '"Segoe UI", sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#f1c40f',
      })
      .setOrigin(0.5);
    this.timerCont.add(this.timerText);

    // 2. Nút Ăn Bài
    this.btnEat = this.createActionButton(width / 2 - 245, actionY, 'ĂN BÀI', 0xf39c12, 95, () => {
      SoundManager.getInstance().playEat();
      this.room.playerEatCard(0);
    });

    // 3. Nút Bốc Bài
    this.btnDraw = this.createActionButton(width / 2 - 145, actionY, 'BỐC BÀI', 0x27ae60, 95, () => {
      SoundManager.getInstance().playDeal();
      this.room.playerDrawCard(0);
    });

    // 4. Nút Đánh Bài
    this.btnDiscard = this.createActionButton(width / 2 - 40, actionY, 'ĐÁNH BÀI', 0xe74c3c, 95, () => {
      if (this.selectedCard) {
        SoundManager.getInstance().playDiscard();
        this.room.playerDiscardCard(0, this.selectedCard);
        this.selectedCard = null;
      }
    });

    // 5. Nút Hạ Phỏm (Vòng 4)
    this.btnLayPhom = this.createActionButton(width / 2 + 65, actionY, 'HẠ PHỎM', 0x2980b9, 95, () => {
      SoundManager.getInstance().playWin();
      this.room.playerLayPhoms(0);
    });

    // 6. Nút Gửi Bài Đã Chọn (Vòng 4)
    this.btnSend = this.createActionButton(width / 2 + 170, actionY, 'GỬI BÀI', 0x8e44ad, 95, () => {
      if (this.selectedCard) {
        SoundManager.getInstance().playCoin();
        const success = this.room.playerSendSingleCard(0, this.selectedCard);
        if (success) {
          this.selectedCard = null;
        }
      }
    });

    // 7. Nút Bỏ qua gửi (Xong gửi để sang Đánh chốt)
    this.btnSkipSend = this.createActionButton(width / 2 + 270, actionY, 'XONG GỬI', 0x16a085, 95, () => {
      this.room.skipSendingCards(0);
    });

    // 8. Nút Xếp Bài
    this.btnSort = this.createActionButton(width / 2 + 370, actionY, 'XẾP BÀI', 0x34495e, 85, () => {
      if (this.sortMode === 'MANUAL' || this.sortMode === 'SUIT') this.sortMode = 'PHOM_LEFT';
      else if (this.sortMode === 'PHOM_LEFT') this.sortMode = 'RANK';
      else if (this.sortMode === 'RANK') this.sortMode = 'SUIT';
      this.renderPlayerHand();
    });
  }

  /**
   * SỬA DỨT ĐIỂM NÚT BẤM KHÓ BẤM:
   * - Căn tâm đối xứng chuẩn xác: Rectangle(-P, -P, width + 2*P, height + 2*P)
   * - Mở rộng 100% diện tích bấm của nút kèm đệm cảm ứng 6px giúp chạm mép nào cũng ăn ngay.
   * - Đặt depth = 30 tách biệt hoàn toàn với bài bên dưới.
   * - Thêm phản hồi xúc giác co nhẹ khi bấm chuột.
   */
  private createActionButton(
    x: number,
    y: number,
    text: string,
    color: number,
    width: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const cont = this.add.container(x, y);
    const btnHeight = 40;
    const P = 6;

    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-width / 2, -btnHeight / 2, width, btnHeight, 20);
    bg.lineStyle(2, 0xffffff, 0.4);
    bg.strokeRoundedRect(-width / 2, -btnHeight / 2, width, btnHeight, 20);
    cont.add(bg);
    (cont as any).bgGraphic = bg;
    (cont as any).baseColor = color;
    (cont as any).btnWidth = width;
    (cont as any).btnHeight = btnHeight;

    const label = this.add
      .text(0, 0, text, {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    cont.add(label);

    cont.setSize(width, btnHeight);
    cont.setInteractive(
      new Phaser.Geom.Rectangle(-P, -P, width + 2 * P, btnHeight + 2 * P),
      Phaser.Geom.Rectangle.Contains
    );
    if (cont.input) cont.input.cursor = 'pointer';
    cont.setDepth(30);

    // Phản hồi bấm nảy tay
    cont.on('pointerdown', () => {
      cont.setScale(0.95);
      onClick();
    });
    cont.on('pointerup', () => cont.setScale(1));
    cont.on('pointerout', () => cont.setScale(1));

    return cont;
  }

  private setButtonState(btn: Phaser.GameObjects.Container, enabled: boolean): void {
    const bg = (btn as any).bgGraphic as Phaser.GameObjects.Graphics;
    const baseColor = (btn as any).baseColor as number;
    const width = (btn as any).btnWidth || btn.width;
    const height = (btn as any).btnHeight || 40;
    const P = 6;

    bg.clear();
    if (enabled) {
      btn.setAlpha(1);
      btn.setInteractive(
        new Phaser.Geom.Rectangle(-P, -P, width + 2 * P, height + 2 * P),
        Phaser.Geom.Rectangle.Contains
      );
      if (btn.input) btn.input.cursor = 'pointer';
      bg.fillStyle(baseColor, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 20);
      bg.lineStyle(2, 0xffffff, 0.85);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 20);
    } else {
      btn.setAlpha(0.35);
      btn.disableInteractive();
      btn.setScale(1);
      bg.fillStyle(0x333333, 0.6);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 20);
      bg.lineStyle(1, 0x666666, 0.3);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 20);
    }
  }

  // Khởi động / Khởi động lại Timer
  private startTurnTimer(): void {
    this.stopTurnTimer();
    this.timerSecondsLeft = GAME_CONFIG.TURN_TIMEOUT_SECONDS;
    this.updateTimerVisual();

    this.turnTimerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.onTimerTick(),
    });
  }

  private resetTurnTimer(): void {
    this.timerSecondsLeft = GAME_CONFIG.TURN_TIMEOUT_SECONDS;
    this.updateTimerVisual();
  }

  private stopTurnTimer(): void {
    if (this.turnTimerEvent) {
      this.turnTimerEvent.destroy();
      this.turnTimerEvent = undefined;
    }
  }

  private onTimerTick(): void {
    if (this.room.isGameOver) {
      this.stopTurnTimer();
      return;
    }

    if (this.room.activeSeat === 0) {
      this.timerSecondsLeft--;
      this.updateTimerVisual();

      if (this.timerSecondsLeft <= 0) {
        this.triggerAutoPlay();
      }
    } else {
      this.timerSecondsLeft = GAME_CONFIG.TURN_TIMEOUT_SECONDS;
      this.updateTimerVisual();
    }
  }

  private updateTimerVisual(): void {
    this.timerCircle.clear();
    const isWarning = this.timerSecondsLeft <= GAME_CONFIG.WARNING_TIME_SECONDS;
    const color = isWarning ? 0xe74c3c : 0xf1c40f;

    this.timerCircle.fillStyle(0x0f1c24, 0.9);
    this.timerCircle.fillCircle(0, 0, 20);
    this.timerCircle.lineStyle(2.5, color, 1);
    this.timerCircle.strokeCircle(0, 0, 20);

    this.timerText.setText(`${this.timerSecondsLeft}s`);
    this.timerText.setColor(isWarning ? '#e74c3c' : '#f1c40f');
  }

  private triggerAutoPlay(): void {
    if (this.room.activeSeat !== 0 || this.room.isGameOver) return;

    if (this.room.turnPhase === 'WAITING_FOR_ACTION') {
      this.showToast('Hết thời gian! Tự động Bốc bài.');
      SoundManager.getInstance().playDeal();
      this.room.playerDrawCard(0);
    } else if (this.room.turnPhase === 'LAYING_PHOMS') {
      this.showToast('Hết thời gian! Tự động Hạ Phỏm.');
      SoundManager.getInstance().playWin();
      this.room.playerLayPhoms(0);
    } else if (this.room.turnPhase === 'SENDING_CARDS') {
      this.showToast('Hết thời gian! Tự động Gửi bài.');
      SoundManager.getInstance().playCoin();
      this.room.playerSendCards(0);
    } else if (this.room.turnPhase === 'DISCARDING') {
      const autoCard = this.room.getAutoDiscardCard(0);
      if (autoCard) {
        this.showToast(`Hết thời gian! Tự động đánh quân ${autoCard.rank}-${autoCard.suit}.`);
        SoundManager.getInstance().playDiscard();
        this.room.playerDiscardCard(0, autoCard);
      }
    }
  }

  // HIỆU ỨNG SỐ XU BAY LÊN (+/- Xu) KHI ĂN BÀI
  private showFloatingCoinText(x: number, y: number, amount: number): void {
    const isPositive = amount >= 0;
    const textStr = isPositive ? `+${amount.toLocaleString()} Xu` : `${amount.toLocaleString()} Xu`;
    const color = isPositive ? '#2ecc71' : '#e74c3c';

    const floatText = this.add
      .text(x, y - 20, textStr, {
        fontFamily: '"Segoe UI", sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: color,
        stroke: '#000000',
        strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 8, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(200);

    this.tweens.add({
      targets: floatText,
      y: y - 70,
      alpha: { from: 1, to: 0 },
      duration: 1400,
      ease: 'Power2',
      onComplete: () => floatText.destroy(),
    });
  }

  private handleCardEatEffect(data: IEatEffectData): void {
    SoundManager.getInstance().playCoin();

    const eaterCont = this.seatContainers[data.eaterSeat];
    if (eaterCont) this.showFloatingCoinText(eaterCont.x, eaterCont.y, data.amount);

    const feederCont = this.seatContainers[data.feederSeat];
    if (feederCont) this.showFloatingCoinText(feederCont.x, feederCont.y, -data.amount);

    const discardCont = this.discardContainers[data.feederSeat];
    const targetSeat = this.seatContainers[data.eaterSeat];

    if (discardCont && targetSeat) {
      const flyCard = this.add
        .image(discardCont.x, discardCont.y, `card_${data.card.suit}_${data.card.rank}`)
        .setDisplaySize(50, 72)
        .setDepth(150);

      this.tweens.add({
        targets: flyCard,
        x: targetSeat.x,
        y: targetSeat.y,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 350,
        ease: 'Cubic.easeOut',
        onComplete: () => flyCard.destroy(),
      });
    }
  }

  private handleCardDiscardEffect(data: IDiscardEffectData): void {
    const seatCont = this.seatContainers[data.discarderSeat];
    const discardCont = this.discardContainers[data.discarderSeat];

    if (seatCont && discardCont) {
      const flyCard = this.add
        .image(seatCont.x, seatCont.y, `card_${data.card.suit}_${data.card.rank}`)
        .setDisplaySize(CARD_WIDTH, CARD_HEIGHT)
        .setDepth(150);

      this.tweens.add({
        targets: flyCard,
        x: discardCont.x,
        y: discardCont.y,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 250,
        ease: 'Quad.easeOut',
        onComplete: () => flyCard.destroy(),
      });
    }
  }

  private handleCardDrawEffect(data: IDrawEffectData): void {
    const seatCont = this.seatContainers[data.seat];
    if (seatCont && this.stockContainer) {
      const flyCard = this.add
        .image(this.stockContainer.x, this.stockContainer.y, 'card_back')
        .setDisplaySize(65, 95)
        .setDepth(150);

      this.tweens.add({
        targets: flyCard,
        x: seatCont.x,
        y: seatCont.y,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 220,
        ease: 'Quad.easeOut',
        onComplete: () => flyCard.destroy(),
      });
    }
  }

  private renderRoomState(): void {
    const isPlayerTurn = this.room.activeSeat === 0;

    const roundLabel =
      this.room.roundNumber === 4 ? 'VÒNG 4/4 (CHỐT BÀI!)' : `VÒNG ${this.room.roundNumber}/4`;
    this.roundBadgeText.setText(`${roundLabel} - CƯỢC ${this.room.betAmount.toLocaleString()} XU`);

    this.stockCountText.setText(this.room.stock.length.toString());

    this.renderSeats();
    this.renderDiscardPiles();
    this.renderLaidPhoms();

    // BẢO VỆ THAO TÁC KÉO THẢ: Không vẽ lại hand nếu người chơi đang kéo bài!
    if (!this.isDraggingCard) {
      this.renderPlayerHand();
    }

    this.renderActionHUD();
    this.renderTurnIndicator();
  }

  /**
   * HIỂN THỊ NÚT THÔNG MINH THEO LƯỢT (Smart Contextual Action HUD):
   * 1. Khi bot đang đi hoặc Game Over: ẨN 100% các nút hành động và timer.
   * 2. Khi đến lượt người chơi: Chỉ hiển thị các nút phù hợp với giai đoạn hiện tại.
   * 3. Tự động căn giữa toàn bộ các nút đang mở đẹp mắt, cân xứng.
   */
  private renderActionHUD(): void {
    const isPlayerTurn = this.room.activeSeat === 0 && !this.gameOverModal && !this.room.isGameOver;

    // 1. Nếu không phải lượt của mình hoặc Game Over: Ẩn toàn bộ nút bàn chơi!
    if (!isPlayerTurn) {
      if (this.timerCont) this.timerCont.setVisible(false);
      if (this.btnEat) this.btnEat.setVisible(false);
      if (this.btnDraw) this.btnDraw.setVisible(false);
      if (this.btnDiscard) this.btnDiscard.setVisible(false);
      if (this.btnLayPhom) this.btnLayPhom.setVisible(false);
      if (this.btnSend) this.btnSend.setVisible(false);
      if (this.btnSkipSend) this.btnSkipSend.setVisible(false);
      if (this.btnSort) this.btnSort.setVisible(false);
      return;
    }

    // 2. Khi đến lượt: Luôn hiện Timer đếm ngược và nút Xếp Bài
    this.timerCont.setVisible(true);
    this.btnSort.setVisible(true);
    this.setButtonState(this.btnSort, true);

    const phase = this.room.turnPhase;
    const oppPhoms = this.room.getOpponentLaidPhoms(0);
    const sendable = findSendableCards(this.room.players[0].hand, oppPhoms);
    const hasSendableSelected =
      !!this.selectedCard && sendable.some((s) => areCardsEqual(s.card, this.selectedCard!));

    const canEatResult =
      phase === 'WAITING_FOR_ACTION' &&
      !!this.room.lastDiscardedCard &&
      canEatCard(
        this.room.players[0].hand,
        this.room.players[0].eatenCards,
        this.room.lastDiscardedCard
      );

    // Giai đoạn 1: Bốc hoặc Ăn
    if (phase === 'WAITING_FOR_ACTION') {
      this.btnDraw.setVisible(true);
      this.setButtonState(this.btnDraw, true);

      if (canEatResult && canEatResult.canEat) {
        this.btnEat.setVisible(true);
        this.setButtonState(this.btnEat, true);
      } else {
        this.btnEat.setVisible(false);
      }

      this.btnDiscard.setVisible(false);
      this.btnLayPhom.setVisible(false);
      this.btnSend.setVisible(false);
      this.btnSkipSend.setVisible(false);
    }
    // Giai đoạn 2: Đánh bài
    else if (phase === 'DISCARDING') {
      this.btnEat.setVisible(false);
      this.btnDraw.setVisible(false);
      this.btnLayPhom.setVisible(false);
      this.btnSend.setVisible(false);
      this.btnSkipSend.setVisible(false);

      this.btnDiscard.setVisible(true);
      const canDiscard = !!this.selectedCard && !this.selectedCard.isEaten;
      this.setButtonState(this.btnDiscard, canDiscard);
    }
    // Giai đoạn 3: Hạ phỏm (Vòng 4)
    else if (phase === 'LAYING_PHOMS') {
      this.btnEat.setVisible(false);
      this.btnDraw.setVisible(false);
      this.btnDiscard.setVisible(false);
      this.btnSend.setVisible(false);
      this.btnSkipSend.setVisible(false);

      this.btnLayPhom.setVisible(true);
      this.setButtonState(this.btnLayPhom, true);
    }
    // Giai đoạn 4: Gửi bài (Vòng 4)
    else if (phase === 'SENDING_CARDS') {
      this.btnEat.setVisible(false);
      this.btnDraw.setVisible(false);
      this.btnDiscard.setVisible(false);
      this.btnLayPhom.setVisible(false);

      this.btnSend.setVisible(true);
      this.setButtonState(this.btnSend, hasSendableSelected);

      this.btnSkipSend.setVisible(true);
      this.setButtonState(this.btnSkipSend, true);
    }

    this.layoutVisibleActionButtons();
  }

  /**
   * Căn giữa tự động tất cả các nút hành động đang hiển thị
   */
  private layoutVisibleActionButtons(): void {
    const { width } = this.scale;
    const allButtons = [
      this.btnEat,
      this.btnDraw,
      this.btnDiscard,
      this.btnLayPhom,
      this.btnSend,
      this.btnSkipSend,
      this.btnSort,
    ];

    const visibleButtons = allButtons.filter((btn) => btn && btn.visible);
    if (visibleButtons.length === 0) {
      if (this.timerCont) this.timerCont.setVisible(false);
      return;
    }

    const gap = 12;
    let totalButtonsWidth = 0;
    visibleButtons.forEach((btn, idx) => {
      const w = (btn as any).btnWidth || 95;
      totalButtonsWidth += w + (idx > 0 ? gap : 0);
    });

    let currentX = width / 2 - totalButtonsWidth / 2;
    visibleButtons.forEach((btn) => {
      const w = (btn as any).btnWidth || 95;
      btn.x = currentX + w / 2;
      currentX += w + gap;
    });

    if (this.timerCont && this.timerCont.visible) {
      this.timerCont.x = width / 2 - totalButtonsWidth / 2 - 32;
    }
  }

  private renderSeats(): void {
    this.seatContainers.forEach((cont, seat) => {
      cont.removeAll(true);
      const p = this.room.players[seat];
      const isCurrentTurn = this.room.activeSeat === seat;

      const bg = this.add.graphics();
      bg.fillStyle(0x0f1c24, 0.85);
      bg.fillRoundedRect(-70, -32, 140, 64, 12);
      bg.lineStyle(2, isCurrentTurn ? 0xf1c40f : 0x34495e, isCurrentTurn ? 1 : 0.6);
      bg.strokeRoundedRect(-70, -32, 140, 64, 12);
      cont.add(bg);

      const name = this.add
        .text(0, -16, p.name, {
          fontFamily: 'sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: isCurrentTurn ? '#f1c40f' : '#ffffff',
        })
        .setOrigin(0.5);
      cont.add(name);

      const coins = this.add
        .text(0, 4, `${p.coins.toLocaleString()} Xu`, {
          fontFamily: 'sans-serif',
          fontSize: '12px',
          color: '#2ecc71',
        })
        .setOrigin(0.5);
      cont.add(coins);

      let statusStr = '';
      if (p.isMom) statusStr = '⚠️ MÓM';
      else if (p.isU) statusStr = '★ Ù!';
      else if (seat !== 0) statusStr = `${p.hand.length} lá`;
      else statusStr = `${p.hand.length} lá trên tay`;

      const status = this.add
        .text(0, 20, statusStr, {
          fontFamily: 'sans-serif',
          fontSize: '11px',
          color: p.isMom ? '#e74c3c' : p.isU ? '#f1c40f' : '#bdc3c7',
        })
        .setOrigin(0.5);
      cont.add(status);

      if (p.eatenCards.length > 0) {
        const eatenCont = this.add.container(seat === 1 ? -90 : 90, 0);
        p.eatenCards.forEach((card, idx) => {
          const eatenImg = this.add
            .image(idx * 16, 0, `card_${card.suit}_${card.rank}`)
            .setDisplaySize(38, 55);
          eatenCont.add(eatenImg);
        });
        cont.add(eatenCont);
      }
    });
  }

  private renderDiscardPiles(): void {
    this.discardContainers.forEach((cont, seat) => {
      cont.removeAll(true);
      const p = this.room.players[seat];

      p.discardedCards.forEach((card, idx) => {
        const isLatest =
          this.room.lastDiscardedCard &&
          areCardsEqual(this.room.lastDiscardedCard, card) &&
          this.room.lastDiscarderSeat === seat;

        const img = this.add.image(idx * 24 - 36, 0, `card_${card.suit}_${card.rank}`).setDisplaySize(48, 70);

        if (isLatest) {
          const halo = this.add.graphics();
          halo.lineStyle(3, 0xf1c40f, 0.95);
          halo.strokeRoundedRect(idx * 24 - 60, -35, 48, 70, 6);
          cont.add(halo);
        }
        cont.add(img);
      });
    });
  }

  private renderLaidPhoms(): void {
    this.laidPhomContainers.forEach((cont, seat) => {
      cont.removeAll(true);
      const p = this.room.players[seat];
      if (!p.hasLaidPhoms || p.laidPhoms.length === 0) return;

      let offsetX = 0;
      p.laidPhoms.forEach((phom) => {
        const phomBorder = this.add.graphics();
        const pw = phom.cards.length * 20 + 26;
        phomBorder.fillStyle(0x0f2a1b, 0.7);
        phomBorder.fillRoundedRect(offsetX - 12, -26, pw, 52, 6);
        phomBorder.lineStyle(1.5, 0x27ae60, 0.8);
        phomBorder.strokeRoundedRect(offsetX - 12, -26, pw, 52, 6);
        cont.add(phomBorder);

        phom.cards.forEach((card, cIdx) => {
          const img = this.add
            .image(offsetX + cIdx * 20, 0, `card_${card.suit}_${card.rank}`)
            .setDisplaySize(38, 55);
          cont.add(img);
        });
        offsetX += phom.cards.length * 20 + 20;
      });
    });
  }

  /**
   * SỬA DỨT ĐIỂM CLICK LỆCH LÁ BÀI & HOÀN THIỆN KÉO THẢ:
   * 1. Chuẩn hóa hitArea: Rectangle(0, 0, hitWidth, CARD_HEIGHT)
   *    -> Tách biệt 100%, không bao giờ trồi lên trên đè vào nút Đánh bài!
   * 2. Chỉ lá bài cuối cùng bên phải mới nhận đủ CARD_WIDTH chiều rộng.
   * 3. Chế độ MANUAL: Giữ nguyên 100% vị trí bài người chơi đã kéo thả.
   */
  private renderPlayerHand(): void {
    for (const obj of this.playerCardObjects) obj.destroy();
    this.playerCardObjects = [];

    const hand = this.room.players[0].hand;
    if (hand.length === 0) return;

    let orderedCards: ICard[] = [];
    let phomCount = 0;

    const bestPhoms = findBestPhomCombination(hand, this.room.players[0].eatenCards, 0);
    const inPhomCardIds = new Set<number>();
    for (const p of bestPhoms.phoms) {
      for (const c of p.cards) inPhomCardIds.add(c.id);
    }

    if (this.sortMode === 'MANUAL') {
      orderedCards = [...hand];
    } else if (this.sortMode === 'PHOM_LEFT' && !this.room.players[0].hasLaidPhoms) {
      const phomCards: ICard[] = [];
      const phomCardIds = new Set<number>();

      for (const p of bestPhoms.phoms) {
        const sortedPhom = sortCardsByRank(p.cards);
        for (const c of sortedPhom) {
          phomCards.push(c);
          phomCardIds.add(c.id);
        }
      }

      const deadwood = hand.filter((c) => !phomCardIds.has(c.id));
      const sortedDeadwood = sortCardsByRank(deadwood);

      orderedCards = [...phomCards, ...sortedDeadwood];
      phomCount = phomCards.length;
      this.room.players[0].hand = orderedCards;
    } else if (this.sortMode === 'SUIT') {
      orderedCards = sortCardsBySuit(hand);
      this.room.players[0].hand = orderedCards;
    } else {
      orderedCards = sortCardsByRank(hand);
      this.room.players[0].hand = orderedCards;
    }

    const oppPhoms = this.room.getOpponentLaidPhoms(0);
    const sendableList = findSendableCards(orderedCards, oppPhoms);
    const sendableIds = new Set(sendableList.map((s) => s.card.id));

    const { width, height } = this.scale;
    const cardSpacing = Math.min(65, (width - 450) / (orderedCards.length || 1));
    const startX = width / 2 - ((orderedCards.length - 1) * cardSpacing) / 2;
    const baseCardY = height - 90;

    orderedCards.forEach((card, idx) => {
      const extraGap = phomCount > 0 && idx >= phomCount ? 20 : 0;
      const cardX = startX + idx * cardSpacing + extraGap;
      const isSelected = this.selectedCard && areCardsEqual(this.selectedCard, card);
      const targetY = isSelected ? baseCardY - 25 : baseCardY;

      const cardCont = this.add.container(cardX, targetY);

      // Nếu được chọn nhấc lên: đặt depth cao hơn các lá bên cạnh
      if (isSelected) {
        cardCont.setDepth(20);
      }

      const cardKey = `card_${card.suit}_${card.rank}`;
      const img = this.add.image(0, 0, cardKey).setDisplaySize(CARD_WIDTH, CARD_HEIGHT);
      cardCont.add(img);

      if (card.isEaten) {
        const eatenBorder = this.add.graphics();
        eatenBorder.lineStyle(3, 0xf1c40f, 1);
        eatenBorder.strokeRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 10);
        cardCont.add(eatenBorder);

        const eatenTag = this.add
          .text(0, -CARD_HEIGHT / 2 + 12, 'ĂN', {
            fontFamily: 'sans-serif',
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#ffffff',
            backgroundColor: '#f39c12',
            padding: { left: 4, right: 4, top: 1, bottom: 1 },
          })
          .setOrigin(0.5);
        cardCont.add(eatenTag);
      } else if (this.sortMode === 'PHOM_LEFT' ? idx < phomCount : inPhomCardIds.has(card.id)) {
        const phomBorder = this.add.graphics();
        phomBorder.lineStyle(2.5, 0x27ae60, 0.95);
        phomBorder.strokeRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 10);
        cardCont.add(phomBorder);
      } else if (this.room.turnPhase === 'SENDING_CARDS' && sendableIds.has(card.id)) {
        const sendBorder = this.add.graphics();
        sendBorder.lineStyle(3, 0x8e44ad, 1);
        sendBorder.strokeRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 10);
        cardCont.add(sendBorder);

        const sendTag = this.add
          .text(0, -CARD_HEIGHT / 2 + 12, 'GỬI', {
            fontFamily: 'sans-serif',
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#ffffff',
            backgroundColor: '#8e44ad',
            padding: { left: 4, right: 4, top: 1, bottom: 1 },
          })
          .setOrigin(0.5);
        cardCont.add(sendTag);
      }

      cardCont.setSize(CARD_WIDTH, CARD_HEIGHT);

      // SỬA DỨT ĐIỂM CLICK LỆCH LÁ BÀI & TRỒI LÊN TRÊN:
      // HitArea bắt đầu từ 0 và có độ rộng bằng visibleWidth
      const visibleWidth =
        idx === orderedCards.length - 1
          ? CARD_WIDTH
          : cardSpacing + (phomCount > 0 && idx === phomCount - 1 ? extraGap : 0);
      const hitWidth = Math.min(CARD_WIDTH, Math.max(30, visibleWidth));

      cardCont.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, hitWidth, CARD_HEIGHT),
        Phaser.Geom.Rectangle.Contains
      );
      if (cardCont.input) cardCont.input.cursor = 'pointer';
      this.input.setDraggable(cardCont);

      let dragStartX = cardX;
      let dragStartY = targetY;
      let hasDragged = false;

      cardCont.on('dragstart', () => {
        this.isDraggingCard = true; // BẬT CỜ BẢO VỆ: BOT ĐÁNH KHÔNG ĐƯỢC PHÁ HỦY HAND
        cardCont.setDepth(100);
        dragStartX = cardCont.x;
        dragStartY = cardCont.y;
        hasDragged = false;
      });

      cardCont.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (Math.abs(dragX - dragStartX) > 6 || Math.abs(dragY - dragStartY) > 6) {
          hasDragged = true;
        }
        cardCont.x = dragX;
        cardCont.y = dragY;
      });

      cardCont.on('dragend', () => {
        this.isDraggingCard = false; // TẮT CỜ BẢO VỆ
        cardCont.setDepth(0);

        if (hasDragged) {
          // Kéo vút lên: Đánh bài
          if (
            cardCont.y < baseCardY - 80 &&
            this.room.activeSeat === 0 &&
            this.room.turnPhase === 'DISCARDING' &&
            !card.isEaten
          ) {
            SoundManager.getInstance().playDiscard();
            this.room.playerDiscardCard(0, card);
            this.selectedCard = null;
            return;
          }

          // Kéo ngang: Đổi chỗ bài trên tay và giữ nguyên vị trí thủ công
          const newIdx = Math.max(
            0,
            Math.min(orderedCards.length - 1, Math.round((cardCont.x - startX) / cardSpacing))
          );

          if (newIdx !== idx) {
            orderedCards.splice(idx, 1);
            orderedCards.splice(newIdx, 0, card);
            this.room.players[0].hand = orderedCards;
            this.sortMode = 'MANUAL'; // CỐ ĐỊNH CHẾ ĐỘ THỦ CÔNG: KHÔNG TỰ ĐẢO LẠI VỊ TRÍ
          }

          this.renderPlayerHand();
        } else {
          // Click chọn bài
          SoundManager.getInstance().playDiscard();
          if (this.selectedCard && areCardsEqual(this.selectedCard, card)) {
            this.selectedCard = null;
          } else {
            this.selectedCard = card;
          }
          this.renderPlayerHand();
          this.renderActionHUD();
        }
      });

      this.playerCardObjects.push(cardCont);
    });
  }

  private renderTurnIndicator(): void {
    this.turnIndicatorGraphics.clear();
    const activeSeat = this.room.activeSeat;
    const seatCont = this.seatContainers[activeSeat];
    if (!seatCont) return;

    this.turnIndicatorGraphics.lineStyle(4, 0xf1c40f, 0.85);
    this.turnIndicatorGraphics.strokeCircle(seatCont.x, seatCont.y, 45);
  }

  private showToast(msg: string): void {
    this.toastText.setText(msg);
    this.tweens.add({
      targets: this.toastText,
      alpha: { from: 1, to: 0.85 },
      duration: 300,
    });
  }

  private showGameOverModal(result: IRoundResult): void {
    SoundManager.getInstance().playWin();
    if (this.gameOverModal) {
      this.gameOverModal.destroy();
      this.gameOverModal = undefined;
    }

    const { width, height } = this.scale;
    const modal = this.add.container(width / 2, height / 2);
    modal.setDepth(1000); // NỔI LÊN TRÊN TOÀN BỘ BÀN CHƠI
    this.gameOverModal = modal;

    // Ẩn toàn bộ nút hành động và timer trong thời gian xem tổng kết
    this.renderActionHUD();

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85);
    overlay.setInteractive();
    modal.add(overlay);

    const box = this.add.graphics();
    box.fillStyle(0x111c24, 1);
    box.fillRoundedRect(-320, -220, 640, 440, 20);
    box.lineStyle(3, 0xd4af37, 1);
    box.strokeRoundedRect(-320, -220, 640, 440, 20);
    modal.add(box);

    const isPlayerWinner = result.winnerSeat === 0;
    const bannerColor = isPlayerWinner ? '#f1c40f' : '#e74c3c';
    const bannerTitle = isPlayerWinner
      ? result.isU
        ? '🏆 CHIẾN THẮNG: BẠN ĐÃ Ù!'
        : '🎉 CHÚC MỪNG: BẠN VỀ NHẤT!'
      : `${this.room.players[result.winnerSeat].name} THẮNG VÁN!`;

    const title = this.add
      .text(0, -180, bannerTitle, {
        fontFamily: '"Segoe UI", sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: bannerColor,
      })
      .setOrigin(0.5);
    modal.add(title);

    result.standings.forEach((st, idx) => {
      const rowY = -120 + idx * 55;
      const rowBg = this.add.graphics();
      rowBg.fillStyle(st.seat === 0 ? 0x1f3a4d : 0x1a2634, 0.9);
      rowBg.fillRoundedRect(-280, rowY - 20, 560, 44, 10);
      modal.add(rowBg);

      const rankBadge = ['🥇 Nhất', '🥈 Nhì', '🥉 Ba', 'Bét'][st.finalRank - 1] || 'Bét';
      const rankText = this.add
        .text(-260, rowY, rankBadge, {
          fontFamily: 'sans-serif',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#f1c40f',
        })
        .setOrigin(0, 0.5);
      modal.add(rankText);

      const nameText = this.add
        .text(-160, rowY, st.name, {
          fontFamily: 'sans-serif',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0, 0.5);
      modal.add(nameText);

      let detailStr = '';
      if (st.isU) detailStr = '★ Ù';
      else if (st.isMom) detailStr = '⚠️ Móm';
      else detailStr = `${st.score} điểm`;

      const detailText = this.add
        .text(50, rowY, detailStr, {
          fontFamily: 'sans-serif',
          fontSize: '15px',
          color: '#bdc3c7',
        })
        .setOrigin(0, 0.5);
      modal.add(detailText);

      const coinStr =
        st.coinChange >= 0
          ? `+${st.coinChange.toLocaleString()} Xu`
          : `${st.coinChange.toLocaleString()} Xu`;
      const coinColor = st.coinChange >= 0 ? '#2ecc71' : '#e74c3c';
      const coinText = this.add
        .text(260, rowY, coinStr, {
          fontFamily: 'sans-serif',
          fontSize: '16px',
          fontStyle: 'bold',
          color: coinColor,
        })
        .setOrigin(1, 0.5);
      modal.add(coinText);
    });

    const nextGameBtn = this.createActionButton(0, 135, 'CHƠI TIẾP VÁN MỚI', 0x27ae60, 240, () => {
      modal.destroy();
      this.gameOverModal = undefined;
      const economy = EconomyService.getInstance();
      if (!economy.canAffordBet(this.betAmount)) {
        this.openAdModal();
      } else {
        SoundManager.getInstance().playDeal();
        const nextDealer = (this.room.dealerSeat + 1) % 4;
        this.startTurnTimer();
        this.room.startNewGame(nextDealer, this.betAmount);
      }
    });
    modal.add(nextGameBtn);

    const lobbyBtn = this.createActionButton(0, 185, 'Về Sảnh Chờ', 0x7f8c8d, 160, () => {
      modal.destroy();
      this.gameOverModal = undefined;
      this.stopTurnTimer();
      this.scene.start('LobbyScene');
    });
    modal.add(lobbyBtn);
  }

  public openAdModal(): void {
    if (this.adModalContainer) {
      this.adModalContainer.destroy();
      this.adModalContainer = undefined;
    }

    const { width, height } = this.scale;
    const modal = this.add.container(width / 2, height / 2);
    modal.setDepth(2000); // Hộp thoại quảng cáo luôn nổi lên trên cùng
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
        fontFamily: '"Segoe UI", sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#f1c40f',
      })
      .setOrigin(0.5);
    modal.add(title);

    const videoFrame = this.add.graphics();
    videoFrame.fillStyle(0x000000, 1);
    videoFrame.fillRoundedRect(-180, -85, 360, 130, 8);
    videoFrame.lineStyle(2, 0x34495e);
    videoFrame.strokeRoundedRect(-180, -85, 360, 130, 8);
    modal.add(videoFrame);

    const adIcon = this.add
      .text(0, -30, '📺\nFacebook Rewarded Video Ad', {
        fontFamily: '"Segoe UI", sans-serif',
        fontSize: '18px',
        color: '#7f8c8d',
        align: 'center',
      })
      .setOrigin(0.5);
    modal.add(adIcon);

    const timerText = this.add
      .text(0, 70, 'Quảng cáo kết thúc sau: 5 giây', {
        fontFamily: '"Segoe UI", sans-serif',
        fontSize: '16px',
        color: '#ecf0f1',
      })
      .setOrigin(0.5);
    modal.add(timerText);

    AdService.showRewardedVideo({
      onAdProgress: (secondsLeft) => {
        timerText.setText(`Quảng cáo kết thúc sau: ${secondsLeft} giây`);
      },
      onAdCompleted: (rewardCoins) => {
        SoundManager.getInstance().playWin();
        timerText.setText(`🎉 Chúc mừng! Bạn nhận được +${rewardCoins.toLocaleString()} Xu!`);
        timerText.setColor('#2ecc71');

        const okBtn = this.createActionButton(0, 115, 'NHẬN THƯỞNG & ĐÓNG', 0x27ae60, 240, () => {
          modal.destroy();
          this.adModalContainer = undefined;
          this.room.players[0].coins = EconomyService.getInstance().getCoins();
          this.renderSeats();
        });
        modal.add(okBtn);
      },
      onAdFailed: (msg) => {
        timerText.setText(msg);
        timerText.setColor('#e74c3c');
      },
    });
  }
}

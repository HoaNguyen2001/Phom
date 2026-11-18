import Phaser from 'phaser';
import { getRankLabel, getSuitColor, getSuitSymbol } from '../core/Card';
import { Rank, Suit } from '../core/Types';

export const CARD_WIDTH = 100;
export const CARD_HEIGHT = 145;

export class CardGraphics {
  /**
   * Tạo tất cả 52 lá bài + mặt sau + phỉnh cược trực tiếp vào Phaser Texture Manager
   */
  public static generateTextures(scene: Phaser.Scene): void {
    const suits = [Suit.SPADES, Suit.CLUBS, Suit.DIAMONDS, Suit.HEARTS];

    for (const suit of suits) {
      for (let rank = Rank.ACE; rank <= Rank.KING; rank++) {
        const textureKey = `card_${suit}_${rank}`;
        if (!scene.textures.exists(textureKey)) {
          this.createCardTexture(scene, textureKey, suit, rank);
        }
      }
    }

    // Mặt sau lá bài
    if (!scene.textures.exists('card_back')) {
      this.createCardBackTexture(scene);
    }

    // Phỉnh Xu
    if (!scene.textures.exists('coin_icon')) {
      this.createCoinTexture(scene);
    }
  }

  private static createCardTexture(
    scene: Phaser.Scene,
    key: string,
    suit: Suit,
    rank: Rank
  ): void {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH * 2;
    canvas.height = CARD_HEIGHT * 2;
    const ctx = canvas.getContext('2d')!;

    ctx.scale(2, 2);

    // Vẽ nền lá bài bo góc
    const r = 10;
    const w = CARD_WIDTH;
    const h = CARD_HEIGHT;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bóng đổ nhẹ bên trong
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(1, 'rgba(240, 240, 245, 0.9)');
    ctx.fillStyle = grad;
    ctx.fill();

    const color = getSuitColor(suit);
    const suitSymbol = getSuitSymbol(suit);
    const rankLabel = getRankLabel(rank);

    // Góc trên bên trái
    ctx.fillStyle = color;
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rankLabel, 18, 20);

    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.fillText(suitSymbol, 18, 38);

    // Biểu tượng to ở giữa
    ctx.font = '46px "Segoe UI", Arial, sans-serif';
    ctx.fillText(suitSymbol, w / 2, h / 2 + 4);

    // Góc dưới bên phải (lộn ngược)
    ctx.save();
    ctx.translate(w - 18, h - 20);
    ctx.rotate(Math.PI);
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText(rankLabel, 0, 0);
    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.fillText(suitSymbol, 0, -18);
    ctx.restore();

    scene.textures.addCanvas(key, canvas);
  }

  private static createCardBackTexture(scene: Phaser.Scene): void {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH * 2;
    canvas.height = CARD_HEIGHT * 2;
    const ctx = canvas.getContext('2d')!;

    ctx.scale(2, 2);

    const r = 10;
    const w = CARD_WIDTH;
    const h = CARD_HEIGHT;

    // Nền trắng
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(0, 0, w, h, r) : ctx.rect(0, 0, w, h);
    ctx.fill();

    // Họa tiết lưng bài màu xanh hoàng gia
    ctx.fillStyle = '#1e3c72';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(4, 4, w - 8, h - 8, 8) : ctx.rect(4, 4, w - 8, h - 8);
    ctx.fill();

    // Khung hoa văn bên trong
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    // Kim cương chính giữa
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2 - 20);
    ctx.lineTo(w / 2 + 20, h / 2);
    ctx.lineTo(w / 2, h / 2 + 20);
    ctx.lineTo(w / 2 - 20, h / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PHỎM', w / 2, h / 2);

    scene.textures.addCanvas('card_back', canvas);
  }

  private static createCoinTexture(scene: Phaser.Scene): void {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#d68910';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#b7950b';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 32, 34);

    scene.textures.addCanvas('coin_icon', canvas);
  }
}

import Phaser from 'phaser';

export const FONT = 'Jua, "Gowun Dodum", sans-serif';

/** 머리 위 말풍선. follow 대상이 움직이면 따라간다 */
export class Bubble {
  readonly text: Phaser.GameObjects.Text;
  private until = 0;

  constructor(
    private scene: Phaser.Scene,
    private target: { x: number; y: number; displayHeight: number },
    color = '#1b1b2f',
    bg = '#ffffff',
  ) {
    this.text = scene.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '16px', color, backgroundColor: bg, padding: { x: 8, y: 5 }, align: 'center', wordWrap: { width: 240 }, resolution: 2 })
      .setOrigin(0.5, 1)
      .setDepth(50)
      .setVisible(false);
  }

  say(line: string, ms: number, style?: { color?: string; bg?: string; size?: number }): void {
    this.text.setText(line);
    if (style?.color) this.text.setColor(style.color);
    if (style?.bg) this.text.setBackgroundColor(style.bg);
    this.text.setFontSize(style?.size ?? 16);
    this.text.setVisible(true);
    this.until = this.scene.time.now + ms;
  }

  hide(): void {
    this.text.setVisible(false);
  }

  update(): void {
    if (!this.text.visible) return;
    if (this.scene.time.now > this.until) {
      this.text.setVisible(false);
      return;
    }
    this.text.setPosition(this.target.x, this.target.y - this.target.displayHeight / 2 - 10);
  }

  destroy(): void {
    this.text.destroy();
  }
}

export function floatText(scene: Phaser.Scene, x: number, y: number, s: string, color = '#ffffff', size = 18): void {
  const t = scene.add
    .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#0d1036', strokeThickness: 4, resolution: 2 })
    .setOrigin(0.5)
    .setDepth(60);
  scene.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
}

export function sparks(scene: Phaser.Scene, x: number, y: number, tint: number, count = 10): void {
  const p = scene.add.particles(x, y, 'spark', {
    speed: { min: 80, max: 260 },
    lifespan: 380,
    scale: { start: 0.9, end: 0 },
    tint,
    quantity: count,
    emitting: false,
  });
  p.setDepth(55);
  p.explode(count);
  scene.time.delayedCall(500, () => p.destroy());
}

/** 칼질 궤적 */
export function slash(scene: Phaser.Scene, x: number, y: number, facing: number, big: boolean): void {
  const g = scene.add.graphics().setDepth(40);
  g.lineStyle(big ? 6 : 4, 0xffe9a8, 0.9);
  const r = big ? 46 : 38;
  const start = facing > 0 ? -1.2 : Math.PI + 1.2;
  const end = facing > 0 ? 1.0 : Math.PI - 1.0;
  g.beginPath();
  g.arc(x, y, r, start, end, facing < 0);
  g.strokePath();
  scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
}

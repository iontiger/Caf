import Phaser from 'phaser';
import { boonById, GIVERS } from '../../logic/boons';
import { VIEW_H, VIEW_W } from '../../logic/run';
import { controls, type Action } from '../controls';
import { FONT } from '../fx';
import { currentStats, isTouch, live, session } from '../state';

const KIND_LABEL = { combat: '부두', elite: '강적', shop: '상점', boss: '깡패 선장' } as const;

/** 체면, 관중 웃음, 금화와 금니, 미소 목록, 터치 버튼 */
export class HudScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private faceText!: Phaser.GameObjects.Text;
  private laughText!: Phaser.GameObjects.Text;
  private purse!: Phaser.GameObjects.Text;
  private roomText!: Phaser.GameObjects.Text;
  private boonText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private talkButton: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('hud');
  }

  create(): void {
    this.g = this.add.graphics();
    const style = { fontFamily: FONT, fontSize: '15px', color: '#ffffff', stroke: '#0d1036', strokeThickness: 4 };
    this.faceText = this.add.text(20, 14, '', style);
    this.laughText = this.add.text(20, 52, '', style);
    this.purse = this.add.text(VIEW_W - 20, 14, '', { ...style, align: 'right' }).setOrigin(1, 0);
    this.roomText = this.add.text(VIEW_W / 2, 14, '', { ...style, fontSize: '17px' }).setOrigin(0.5, 0);
    this.boonText = this.add.text(20, 92, '', { ...style, fontSize: '13px', color: '#e8e0ff', lineSpacing: 3 }).setAlpha(0.9);
    this.bossText = this.add.text(VIEW_W / 2, 62, '', { ...style, fontSize: '13px', color: '#ffe9a8' }).setOrigin(0.5, 0.5);
    this.promptText = this.add
      .text(VIEW_W / 2, VIEW_H - 110, '', { ...style, fontSize: '18px', backgroundColor: '#0d1036cc', padding: { x: 10, y: 5 } })
      .setOrigin(0.5);
    this.bannerText = this.add
      .text(VIEW_W / 2, 170, '', { fontFamily: FONT, fontSize: '30px', color: '#ffd36b', stroke: '#0d1036', strokeThickness: 7, align: 'center', wordWrap: { width: 860 } })
      .setOrigin(0.5)
      .setAlpha(0);
    this.game.events.on('banner', this.banner, this);
    this.events.once('shutdown', () => this.game.events.off('banner', this.banner, this));
    if (isTouch()) this.makeTouch();
  }

  private banner(text: string, ms = 1800, color = '#ffd36b', size = 30): void {
    this.tweens.killTweensOf(this.bannerText);
    this.bannerText.setText(text).setColor(color).setFontSize(size).setAlpha(1).setScale(1.15);
    this.tweens.add({ targets: this.bannerText, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.bannerText, alpha: 0, delay: ms, duration: 400 });
  }

  update(): void {
    const run = session.run;
    const g = this.g;
    g.clear();
    const inRun = !!run && (this.scene.isActive('run') || this.scene.isPaused('run'));
    this.faceText.setVisible(!!run && inRun);
    this.laughText.setVisible(!!run && inRun);
    this.roomText.setVisible(!!run && inRun);
    this.boonText.setVisible(!!run && inRun);
    if (run && inRun) {
      const stats = currentStats();
      const face = Math.max(0, run.face);
      this.bar(20, 34, 240, 14, face / stats.maxFace, 0xff6b6b);
      this.faceText.setText(`체면 ${Math.ceil(face)} / ${stats.maxFace}`);
      const full = live.laughter >= 100;
      this.bar(20, 72, 200, 10, live.laughter / 100, full && Math.floor(this.time.now / 200) % 2 ? 0xffffff : 0xffd36b);
      this.laughText.setText(full ? '관중 웃음 가득! 필살 대사 (O)' : '관중 웃음');
      const room = run.plan[run.roomIndex];
      this.roomText.setText(`${KIND_LABEL[room.kind]} · 방 ${run.roomIndex + 1} / ${run.plan.length}`);
      this.purse.setText(`금화 ${run.gold}   금니 ${session.meta.teeth}   럼병 ${run.rum} (Q)`);
      this.boonText.setText(run.boons.map((id) => `${GIVERS[boonById(id).giver].icon} ${boonById(id).name}`).join('\n'));
    } else {
      this.purse.setText(`금니 ${session.meta.teeth}`);
    }
    if (live.boss && inRun) {
      const w = 380;
      this.bar(VIEW_W / 2 - w / 2, 54, w, 16, live.boss.hp / live.boss.max, 0xc0392b);
      this.bossText.setText(`${live.boss.name} ${Math.ceil(live.boss.hp)} / ${live.boss.max}`).setVisible(true);
    } else {
      this.bossText.setVisible(false);
    }
    this.promptText.setText(live.prompt).setVisible(!!live.prompt);
    this.talkButton?.setVisible(!!live.prompt);
  }

  private bar(x: number, y: number, w: number, h: number, ratio: number, color: number): void {
    this.g.fillStyle(0x0d1036, 0.85).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 4);
    this.g.fillStyle(color).fillRoundedRect(x, y, Math.max(0, Math.min(1, ratio)) * w, h, 3);
  }

  private makeTouch(): void {
    this.input.addPointer(4);
    const button = (x: number, y: number, r: number, label: string, action: Action, size = 16) => {
      const circle = this.add.circle(0, 0, r, 0xffffff, 0.16).setStrokeStyle(2, 0xffffff, 0.45);
      const text = this.add.text(0, 0, label, { fontFamily: FONT, fontSize: `${size}px`, color: '#ffffff' }).setOrigin(0.5).setAlpha(0.85);
      const c = this.add.container(x, y, [circle, text]).setSize(r * 2, r * 2).setDepth(100);
      c.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
      const down = () => {
        controls.virtual(action, true);
        circle.setFillStyle(0xffd36b, 0.4);
      };
      const up = () => {
        controls.virtual(action, false);
        circle.setFillStyle(0xffffff, 0.16);
      };
      c.on('pointerdown', down);
      c.on('pointerup', up);
      c.on('pointerout', up);
      c.on('pointerover', (p: Phaser.Input.Pointer) => p.isDown && down());
      return c;
    };
    button(78, 462, 46, '◀', 'left', 26);
    button(190, 462, 46, '▶', 'right', 26);
    button(134, 520, 22, '▼', 'down', 14);
    button(878, 468, 44, '공격', 'attack');
    button(788, 500, 34, '점프', 'jump');
    button(796, 408, 34, '받아\n치기', 'parry', 14);
    button(888, 374, 30, '구르기', 'dodge', 14);
    button(706, 496, 28, '필살', 'finisher', 14);
    button(906, 296, 24, '럼', 'item', 14);
    this.talkButton = button(708, 412, 28, 'E', 'interact', 18).setVisible(false);
  }
}

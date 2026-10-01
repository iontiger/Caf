import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../../logic/run';
import { FONT } from '../fx';
import { session, startRun } from '../state';

/** 타이틀 그림을 띄우고 아무 입력이나 기다린다 */
export class TitleScene extends Phaser.Scene {
  private started = false;

  constructor() {
    super('title');
  }

  create(): void {
    this.started = false;
    const img = this.add.image(VIEW_W / 2, VIEW_H / 2, 'title');
    img.setScale(Math.max(VIEW_W / img.width, VIEW_H / img.height));
    const g = this.add.graphics();
    g.fillGradientStyle(0x05061a, 0x05061a, 0x05061a, 0x05061a, 0, 0, 0.9, 0.9).fillRect(0, VIEW_H - 150, VIEW_W, 150);
    const prompt = this.add
      .text(VIEW_W / 2, VIEW_H - 72, '아무 키나 누르거나 화면을 눌러 시작', { fontFamily: FONT, fontSize: '24px', color: '#ffd36b', stroke: '#0d1036', strokeThickness: 6 })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    const meta = session.meta;
    const record = meta.runs > 0 ? `출격 ${meta.runs}번 · 승리 ${meta.wins}번 · 금니 ${meta.teeth}개` : '횡스크롤 액션 프로토타입 · 1지역 부두';
    this.add
      .text(VIEW_W / 2, VIEW_H - 34, `${record}   ·   M 소리 끄기`, { fontFamily: FONT, fontSize: '14px', color: '#cfc8f0' })
      .setOrigin(0.5);

    this.input.keyboard?.once('keydown', () => this.go());
    this.input.once('pointerdown', () => this.go());
  }

  private go(): void {
    if (this.started) return;
    this.started = true;
    const hash = location.hash;
    // 개발용 바로가기: #boss, #shop, #room=4
    const m = hash.match(/room=(\d+)/);
    const jump = hash.includes('boss') ? 7 : hash.includes('shop') ? 5 : m ? Number(m[1]) : -1;
    this.scene.launch('hud');
    if (jump >= 0) {
      const run = startRun();
      run.roomIndex = Math.min(jump, run.plan.length - 1);
      run.boons = hash.includes('boons') ? ['kp-window', 'fw-slap', 'fw-stink'] : [];
      session.meta.seenIntro = true;
      this.scene.start('run');
      return;
    }
    this.scene.start('hub');
  }
}

import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../../logic/run';
import { controls } from '../controls';
import { FONT } from '../fx';
import { sfx } from '../sfx';

export interface MenuCard {
  title: string;
  body: string;
  tag?: string;
  color?: number;
  disabled?: boolean;
  onPick: () => void;
}

export interface MenuData {
  title: string;
  subtitle?: string;
  cards: MenuCard[];
  /** 메뉴가 닫히면 다시 움직일 장면 */
  resume?: string;
}

/** 미소 고르기, 상점, 강화, 결과 화면이 함께 쓰는 카드 메뉴 */
export class MenuScene extends Phaser.Scene {
  private data2!: MenuData;
  private cards: Phaser.GameObjects.Container[] = [];
  private frames: Phaser.GameObjects.Rectangle[] = [];
  private index = 0;
  private openedAt = 0;
  private done = false;

  constructor() {
    super('menu');
  }

  create(data: MenuData): void {
    this.data2 = data;
    this.cards = [];
    this.frames = [];
    this.done = false;
    this.openedAt = this.time.now;
    this.index = Math.max(0, data.cards.findIndex((c) => !c.disabled));

    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05061a, 0.8).setOrigin(0).setInteractive();
    this.add
      .text(VIEW_W / 2, 62, data.title, { fontFamily: FONT, fontSize: '34px', color: '#ffd36b', stroke: '#0d1036', strokeThickness: 6 })
      .setOrigin(0.5);
    if (data.subtitle) {
      this.add
        .text(VIEW_W / 2, 104, data.subtitle, { fontFamily: FONT, fontSize: '17px', color: '#e8e0ff', align: 'center', wordWrap: { width: 820 }, lineSpacing: 6 })
        .setOrigin(0.5, 0);
    }

    const n = data.cards.length;
    const gap = 16;
    const cardW = Math.min(230, (900 - (n - 1) * gap) / n);
    const cardH = 220;
    const total = n * cardW + (n - 1) * gap;
    const top = data.subtitle ? Math.max(250, 140 + this.subtitleHeight(data.subtitle)) : 200;
    data.cards.forEach((c, i) => {
      const x = VIEW_W / 2 - total / 2 + cardW / 2 + i * (cardW + gap);
      const y = Math.min(top + cardH / 2, VIEW_H - cardH / 2 - 40);
      const accent = c.color ?? 0xffd36b;
      const frame = this.add.rectangle(0, 0, cardW, cardH, 0x1b1640, 0.96).setStrokeStyle(2, accent, 0.7);
      const items: Phaser.GameObjects.GameObject[] = [frame];
      let ty = -cardH / 2 + 14;
      if (c.tag) {
        items.push(
          this.add.text(0, ty, c.tag, { fontFamily: FONT, fontSize: '13px', color: '#' + accent.toString(16).padStart(6, '0') }).setOrigin(0.5, 0),
        );
        ty += 22;
      }
      items.push(
        this.add
          .text(0, ty, c.title, { fontFamily: FONT, fontSize: '20px', color: '#ffffff', align: 'center', wordWrap: { width: cardW - 20 } })
          .setOrigin(0.5, 0),
      );
      items.push(
        this.add
          .text(0, ty + 56, c.body, { fontFamily: FONT, fontSize: '15px', color: '#cfc8f0', align: 'center', wordWrap: { width: cardW - 22 }, lineSpacing: 4 })
          .setOrigin(0.5, 0),
      );
      const card = this.add.container(x, y, items).setSize(cardW, cardH);
      if (c.disabled) card.setAlpha(0.45);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerover', () => this.select(i));
      card.on('pointerup', () => {
        this.select(i);
        this.pick();
      });
      this.cards.push(card);
      this.frames.push(frame);
    });
    this.add
      .text(VIEW_W / 2, VIEW_H - 22, '← → 고르기 · E / J / 스페이스 결정 · 화면을 눌러도 됩니다', { fontFamily: FONT, fontSize: '14px', color: '#8a84b8' })
      .setOrigin(0.5);
    this.select(this.index);
  }

  private subtitleHeight(s: string): number {
    return Math.ceil(s.length / 46) * 26 + (s.split('\n').length - 1) * 26;
  }

  private select(i: number): void {
    this.index = i;
    this.cards.forEach((c, j) => {
      c.setScale(j === i ? 1.05 : 1);
      this.frames[j].setStrokeStyle(j === i ? 4 : 2, this.data2.cards[j].color ?? 0xffd36b, j === i ? 1 : 0.6);
    });
  }

  private pick(): void {
    if (this.done || this.time.now - this.openedAt < 220) return;
    const card = this.data2.cards[this.index];
    if (card.disabled) {
      this.tweens.add({ targets: this.cards[this.index], x: '+=6', duration: 40, yoyo: true, repeat: 2 });
      return;
    }
    this.done = true;
    sfx.coin();
    this.scene.stop();
    if (this.data2.resume) this.scene.resume(this.data2.resume);
    card.onPick();
  }

  update(): void {
    const n = this.cards.length;
    if (controls.justPressed('left')) this.select((this.index + n - 1) % n);
    if (controls.justPressed('right')) this.select((this.index + 1) % n);
    if (controls.justPressed('interact') || controls.justPressed('attack') || controls.justPressed('jump')) this.pick();
  }
}

/** 실행 중인 장면을 멈추고 메뉴를 띄운다 */
export function openMenu(scene: Phaser.Scene, data: Omit<MenuData, 'resume'>): void {
  const key = scene.scene.key;
  scene.scene.pause();
  scene.scene.launch('menu', { ...data, resume: key });
  scene.scene.bringToTop('menu');
}

import Phaser from 'phaser';
import { GROUND_Y, VIEW_H, VIEW_W, type Platform, type Theme } from '../logic/run';

/** 시차 배경. 먼 층일수록 카메라를 덜 따라온다 */
function layerWidth(roomW: number, factor: number): number {
  return VIEW_W + (roomW - VIEW_W) * factor + 40;
}

function stars(g: Phaser.GameObjects.Graphics, w: number, h: number, n: number, seed: number): void {
  const rnd = new Phaser.Math.RandomDataGenerator([String(seed)]);
  for (let i = 0; i < n; i++) {
    g.fillStyle(0xffffff, rnd.realInRange(0.3, 0.9));
    g.fillCircle(rnd.between(0, w), rnd.between(0, h), rnd.realInRange(0.6, 1.8));
  }
}

function sky(scene: Phaser.Scene, top: number, bottom: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(-100);
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  return g;
}

function moon(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0xfff1c8, 0.12).fillCircle(x, y, 70);
  g.fillStyle(0xfff1c8, 0.2).fillCircle(x, y, 50);
  g.fillStyle(0xfff6dc, 1).fillCircle(x, y, 34);
  g.fillStyle(0xe8d9b0, 1).fillCircle(x - 10, y - 6, 6).fillCircle(x + 8, y + 10, 4);
}

function sea(scene: Phaser.Scene, roomW: number, y: number, color: number): void {
  const f = 0.25;
  const w = layerWidth(roomW, f);
  const g = scene.add.graphics().setScrollFactor(f, 1).setDepth(-80);
  g.fillStyle(color).fillRect(0, y, w, VIEW_H - y);
  for (let i = 0; i < w; i += 46) {
    g.fillStyle(0xfff1c8, 0.18).fillRect(i + ((i * 7) % 23), y + 10 + ((i * 13) % 50), 22, 2);
  }
}

function village(scene: Phaser.Scene, roomW: number): void {
  // 멀리 보이는 언덕 위 저택 (사진사가 사는 곳)
  const far = scene.add.graphics().setScrollFactor(0.12, 1).setDepth(-90);
  far.fillStyle(0x2a1f55).fillTriangle(380, 360, 620, 150, 860, 360);
  far.fillStyle(0x1c1540).fillRect(580, 120, 80, 70).fillTriangle(570, 122, 620, 80, 670, 122);
  far.fillStyle(0xffe08a).fillRect(600, 140, 10, 12).fillRect(630, 140, 10, 12);
  // 중간층: 부두 마을 집들
  const f = 0.45;
  const w = layerWidth(roomW, f);
  const mid = scene.add.graphics().setScrollFactor(f, 1).setDepth(-70);
  const rnd = new Phaser.Math.RandomDataGenerator(['village']);
  for (let x = -20; x < w; x += rnd.between(120, 190)) {
    const hw = rnd.between(70, 110);
    const hh = rnd.between(70, 130);
    const base = 410;
    mid.fillStyle(rnd.pick([0x3a2a5a, 0x46305e, 0x2e2350]));
    mid.fillRect(x, base - hh, hw, hh + 20);
    mid.fillStyle(rnd.pick([0x5a2a3a, 0x6b3a2a, 0x3a2a4a]));
    mid.fillTriangle(x - 8, base - hh, x + hw / 2, base - hh - 36, x + hw + 8, base - hh);
    for (let wy = base - hh + 18; wy < base - 10; wy += 30) {
      if (rnd.frac() < 0.6) mid.fillStyle(0xffd36b, 0.9).fillRect(x + 14, wy, 12, 14);
      if (rnd.frac() < 0.5) mid.fillStyle(0xffd36b, 0.9).fillRect(x + hw - 26, wy, 12, 14);
    }
  }
}

function cave(scene: Phaser.Scene, roomW: number): void {
  const f1 = 0.2;
  const far = scene.add.graphics().setScrollFactor(f1, 1).setDepth(-90);
  const w1 = layerWidth(roomW, f1);
  const rnd = new Phaser.Math.RandomDataGenerator(['cave']);
  far.fillStyle(0x1a1730);
  for (let x = 0; x < w1; x += 60) far.fillTriangle(x, 0, x + 30, rnd.between(60, 160), x + 60, 0);
  for (let x = 0; x < w1; x += 90) far.fillTriangle(x, VIEW_H, x + 45, rnd.between(300, 380), x + 90, VIEW_H);
  const f2 = 0.5;
  const mid = scene.add.graphics().setScrollFactor(f2, 1).setDepth(-70);
  const w2 = layerWidth(roomW, f2);
  for (let x = 40; x < w2; x += rnd.between(160, 260)) {
    mid.fillStyle(0x24203c).fillRect(x, 0, rnd.between(30, 50), VIEW_H);
    // 빛나는 버섯과 수정
    const cx = x + rnd.between(-30, 60);
    mid.fillStyle(0x7fd6c2, 0.18).fillCircle(cx, 440, 26);
    mid.fillStyle(0x7fd6c2).fillTriangle(cx - 6, 456, cx, 420, cx + 6, 456);
    mid.fillStyle(0xc89bff).fillTriangle(cx + 10, 456, cx + 16, 432, cx + 22, 456);
  }
  // 동굴에 버려진 보물 상자
  mid.fillStyle(0x6b4423).fillRect(w2 * 0.6, 430, 40, 26);
  mid.fillStyle(0xffd36b).fillRect(w2 * 0.6 + 16, 438, 8, 8);
}

function ship(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setScrollFactor(0.3, 1).setDepth(-75);
  // 돛대와 돛
  g.fillStyle(0x4a3020).fillRect(470, 0, 18, 480);
  g.fillStyle(0xe8dcc0, 0.9).fillTriangle(488, 40, 488, 300, 700, 300);
  g.fillStyle(0x1c1626).fillCircle(560, 230, 22);
  g.fillStyle(0xe8dcc0).fillRect(548, 250, 24, 6);
  g.fillStyle(0x4a3020).fillRect(300, 120, 360, 10);
  // 뱃전 난간
  const rail = scene.add.graphics().setDepth(-60);
  rail.fillStyle(0x5a3a22).fillRect(0, GROUND_Y - 46, 960, 8);
  for (let x = 10; x < 960; x += 40) rail.fillRect(x, GROUND_Y - 40, 6, 40);
}

export function drawBackground(scene: Phaser.Scene, theme: Theme, roomW: number): void {
  if (theme === 'dock') {
    const g = sky(scene, 0x120d3a, 0x7a3a6b);
    stars(g, VIEW_W, 260, 70, 1);
    moon(g, 760, 90);
    village(scene, roomW);
    sea(scene, roomW, 400, 0x1f2a5e);
  } else if (theme === 'cave') {
    sky(scene, 0x07060f, 0x1d1a2e);
    cave(scene, roomW);
  } else {
    const g = sky(scene, 0x0b0c30, 0x3a2d6b);
    stars(g, VIEW_W, 300, 90, 3);
    moon(g, 820, 150);
    sea(scene, roomW, 380, 0x1a2456);
    ship(scene);
  }
  // 뒷배경을 살짝 눌러 인물과 발판이 먼저 보이게 한다
  scene.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x0d1036, theme === 'cave' ? 0.1 : 0.28).setOrigin(0).setScrollFactor(0).setDepth(-55);
  drawGround(scene, theme, roomW);
}

function drawGround(scene: Phaser.Scene, theme: Theme, roomW: number): void {
  const g = scene.add.graphics().setDepth(5);
  if (theme === 'cave') {
    g.fillStyle(0x2e2a3a).fillRect(0, GROUND_Y, roomW, VIEW_H - GROUND_Y);
    g.fillStyle(0x4a4560).fillRect(0, GROUND_Y, roomW, 6);
    for (let x = 0; x < roomW; x += 70) g.fillStyle(0x24203c).fillCircle(x + 30, GROUND_Y + 30, 10);
  } else {
    const plank = theme === 'ship' ? 0x7a5230 : 0x6b4423;
    g.fillStyle(plank).fillRect(0, GROUND_Y, roomW, VIEW_H - GROUND_Y);
    g.fillStyle(0x9a6a3a).fillRect(0, GROUND_Y, roomW, 5);
    g.lineStyle(2, 0x3a2414, 0.8);
    for (let x = 0; x < roomW; x += 64) g.lineBetween(x, GROUND_Y + 5, x, VIEW_H);
    g.lineBetween(0, GROUND_Y + 30, roomW, GROUND_Y + 30);
  }
}

export function drawPlatform(scene: Phaser.Scene, theme: Theme, p: Platform): void {
  const g = scene.add.graphics().setDepth(6);
  if (theme === 'cave') {
    g.fillStyle(0x3a3550).fillRoundedRect(p.x, p.y, p.w, 22, 8);
    g.fillStyle(0x5a8a5a).fillRect(p.x + 6, p.y, p.w - 12, 4);
    g.fillStyle(0x2a2640).fillTriangle(p.x + 20, p.y + 22, p.x + 34, p.y + 50, p.x + 48, p.y + 22);
    g.fillTriangle(p.x + p.w - 50, p.y + 22, p.x + p.w - 38, p.y + 44, p.x + p.w - 26, p.y + 22);
  } else {
    // 나무 판자와 받침 기둥
    g.fillStyle(0x4a3020).fillRect(p.x + 14, p.y + 12, 10, GROUND_Y - p.y - 12);
    g.fillRect(p.x + p.w - 24, p.y + 12, 10, GROUND_Y - p.y - 12);
    g.fillStyle(0x8a5a2b).fillRect(p.x, p.y, p.w, 14);
    g.fillStyle(0xb07a3a).fillRect(p.x, p.y, p.w, 3);
    g.lineStyle(1, 0x3a2414, 0.7);
    for (let x = p.x + 40; x < p.x + p.w; x += 40) g.lineBetween(x, p.y, x, p.y + 14);
  }
}

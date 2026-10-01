import Phaser from 'phaser';

/** 그림 파일 없이 도형으로 캐릭터와 소품을 그린다. 정식 아트가 나오면 이 파일만 바꾸면 된다 */
type G = Phaser.GameObjects.Graphics;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

const SKIN = 0xf0c8a0;
const OUTLINE = 0x14102a;

function person(
  g: G,
  o: { w: number; h: number; shirt: number; pants: number; hair: number; sash?: number; hat?: number; beard?: number; stripes?: number },
): void {
  const { w, h } = o;
  const headR = Math.round(w * 0.3);
  const cx = w / 2;
  const legTop = h * 0.66;
  // 다리
  g.fillStyle(o.pants);
  g.fillRect(cx - w * 0.28, legTop, w * 0.22, h - legTop - 3);
  g.fillRect(cx + w * 0.06, legTop, w * 0.22, h - legTop - 3);
  g.fillStyle(OUTLINE);
  g.fillRect(cx - w * 0.32, h - 4, w * 0.28, 4);
  g.fillRect(cx + w * 0.04, h - 4, w * 0.28, 4);
  // 몸통
  g.fillStyle(o.shirt);
  g.fillRoundedRect(cx - w * 0.36, headR * 2 + 2, w * 0.72, legTop - headR * 2, 5);
  if (o.stripes !== undefined) {
    g.fillStyle(o.stripes);
    for (let y = headR * 2 + 6; y < legTop - 2; y += 6) g.fillRect(cx - w * 0.36, y, w * 0.72, 2);
  }
  if (o.sash !== undefined) {
    g.fillStyle(o.sash);
    g.fillRect(cx - w * 0.38, legTop - 7, w * 0.76, 7);
  }
  // 머리
  g.fillStyle(SKIN);
  g.fillCircle(cx, headR + 2, headR);
  g.fillStyle(o.hair);
  g.fillEllipse(cx - 1, headR - 1, headR * 2.1, headR * 1.2);
  if (o.beard !== undefined) {
    g.fillStyle(o.beard);
    g.fillEllipse(cx + 2, headR * 1.8 + 2, headR * 1.6, headR * 0.9);
  }
  if (o.hat !== undefined) {
    g.fillStyle(o.hat);
    g.fillRect(cx - headR * 1.4, headR * 0.3, headR * 2.8, 4);
    g.fillRoundedRect(cx - headR, -1, headR * 2, headR * 0.9, 3);
  }
  // 눈 (오른쪽을 본다)
  g.fillStyle(OUTLINE);
  g.fillRect(cx + headR * 0.35, headR + 1, 2, 3);
}

export function makeTextures(scene: Phaser.Scene): void {
  make(scene, 'aul', 32, 48, (g) => {
    person(g, { w: 32, h: 48, shirt: 0xf4efe6, pants: 0x3b2a2a, hair: 0xf2c14e, sash: 0xc0392b });
    // 꽁지머리
    g.fillStyle(0xf2c14e);
    g.fillTriangle(5, 8, 0, 20, 9, 14);
    g.fillStyle(0xc0392b);
    g.fillRect(4, 10, 4, 3);
  });

  make(scene, 'sword', 38, 8, (g) => {
    g.fillStyle(0xd9dde8);
    g.fillTriangle(10, 2, 38, 4, 10, 6);
    g.fillStyle(0xffd36b);
    g.fillRect(6, 0, 4, 8);
    g.fillStyle(0x6b3d0f);
    g.fillRect(0, 2, 6, 4);
  });

  make(scene, 'sailor', 32, 46, (g) => {
    person(g, { w: 32, h: 46, shirt: 0xf4efe6, stripes: 0x3a5fb0, pants: 0x2a3550, hair: 0x6b4a2a, beard: 0x6b4a2a, hat: 0x2a3550 });
    g.fillStyle(0x3d8a4a);
    g.fillRoundedRect(25, 22, 6, 12, 2);
  });

  make(scene, 'thrower', 32, 46, (g) => {
    person(g, { w: 32, h: 46, shirt: 0x8a5a2b, pants: 0x3b2a2a, hair: 0x2a1a10, hat: 0xc0392b });
    g.lineStyle(2, 0xd8b26a);
    g.strokeCircle(8, 26, 5);
  });

  make(scene, 'crab', 36, 22, (g) => {
    g.fillStyle(0xd9483b);
    g.fillEllipse(18, 14, 26, 14);
    g.fillCircle(4, 8, 5);
    g.fillCircle(32, 8, 5);
    g.fillStyle(0xf4efe6);
    g.fillCircle(14, 5, 3);
    g.fillCircle(22, 5, 3);
    g.fillStyle(OUTLINE);
    g.fillCircle(14, 5, 1.5);
    g.fillCircle(22, 5, 1.5);
    g.fillStyle(0xa83228);
    for (const x of [8, 13, 23, 28]) g.fillRect(x, 18, 2, 4);
  });

  make(scene, 'bosun', 46, 62, (g) => {
    person(g, { w: 46, h: 62, shirt: 0x4a6a3a, pants: 0x2a2a35, hair: 0x9a9a9a, beard: 0x9a9a9a, sash: 0x2a2a35 });
    g.lineStyle(3, 0xc0c4d0);
    g.beginPath();
    g.arc(42, 40, 5, Math.PI * 0.5, Math.PI * 1.8);
    g.strokePath();
    // 어깨 위 앵무새
    g.fillStyle(0x3fbf5a);
    g.fillEllipse(8, 18, 12, 14);
    g.fillStyle(0xffd36b);
    g.fillTriangle(2, 15, -2, 18, 2, 19);
    g.fillStyle(0xd9483b);
    g.fillRect(6, 23, 5, 5);
  });

  make(scene, 'captain', 56, 76, (g) => {
    person(g, { w: 56, h: 76, shirt: 0x7a2348, pants: 0x1c1626, hair: 0x1c1626, beard: 0x1c1626, hat: 0x1c1626, sash: 0xffd36b });
    // 해골 문양과 금단추
    g.fillStyle(0xf4efe6);
    g.fillCircle(28, 6, 3);
    g.fillStyle(0xffd36b);
    for (const y of [36, 44, 52]) g.fillCircle(28, y, 2);
    // 긴 외투 자락
    g.fillStyle(0x7a2348);
    g.fillTriangle(8, 48, 4, 70, 16, 60);
    g.fillTriangle(48, 48, 52, 70, 40, 60);
  });

  make(scene, 'barkeep', 36, 50, (g) => {
    person(g, { w: 36, h: 50, shirt: 0xb05a2a, pants: 0x3b2a2a, hair: 0x5a3a20, beard: 0x5a3a20 });
    g.fillStyle(0xf4efe6);
    g.fillRect(9, 24, 18, 22);
  });

  make(scene, 'keeper', 34, 48, (g) => {
    person(g, { w: 34, h: 48, shirt: 0xf2c14e, pants: 0x2a3550, hair: 0xd0d0d0, beard: 0xd0d0d0, hat: 0xf2c14e });
    g.fillStyle(0xffe9a8);
    g.fillCircle(30, 34, 4);
  });

  make(scene, 'merchant', 34, 46, (g) => {
    g.fillStyle(0x6b4a2a);
    g.fillRoundedRect(0, 12, 12, 22, 3);
    person(g, { w: 34, h: 46, shirt: 0x5a4a8a, pants: 0x2a2a35, hair: 0x2a1a10, hat: 0x3a2a5a });
  });

  make(scene, 'bottle', 10, 18, (g) => {
    g.fillStyle(0x3d8a4a);
    g.fillRoundedRect(1, 6, 8, 12, 2);
    g.fillRect(3, 0, 4, 7);
  });

  make(scene, 'cannonball', 20, 20, (g) => {
    g.fillStyle(0x222233);
    g.fillCircle(10, 10, 10);
    g.fillStyle(0x555577);
    g.fillCircle(7, 7, 3);
  });

  make(scene, 'door', 64, 100, (g) => {
    g.fillStyle(0x3a2414);
    g.fillRoundedRect(0, 8, 64, 92, { tl: 32, tr: 32, bl: 0, br: 0 });
    g.fillStyle(0x6b4423);
    g.fillRoundedRect(6, 14, 52, 86, { tl: 26, tr: 26, bl: 0, br: 0 });
    g.lineStyle(2, 0x3a2414);
    g.lineBetween(32, 16, 32, 100);
    g.fillStyle(0xffd36b);
    g.fillCircle(44, 60, 3);
  });

  make(scene, 'spark', 8, 8, (g) => {
    g.fillStyle(0xffffff);
    g.fillCircle(4, 4, 4);
  });

  make(scene, 'shadow', 40, 10, (g) => {
    g.fillStyle(0x000000, 0.5);
    g.fillEllipse(20, 5, 40, 10);
  });
}

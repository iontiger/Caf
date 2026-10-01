import Phaser from 'phaser';
import { controls } from './game/controls';
import { BootScene } from './game/scenes/BootScene';
import { HubScene } from './game/scenes/HubScene';
import { HudScene } from './game/scenes/HudScene';
import { MenuScene } from './game/scenes/MenuScene';
import { RunScene } from './game/scenes/RunScene';
import { TitleScene } from './game/scenes/TitleScene';
import { sfx } from './game/sfx';
import { session } from './game/state';
import { GRAVITY, VIEW_H, VIEW_W } from './logic/run';
import './style.css';

async function waitForFonts(): Promise<void> {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('20px Jua'), document.fonts.load('20px "Gowun Dodum"')]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    // 글꼴을 못 받아도 기본 글꼴로 시작한다
  }
}

async function main(): Promise<void> {
  await waitForFonts();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#05061a',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: GRAVITY }, debug: location.hash.includes('debug') } },
    input: { activePointers: 5 },
    // 30fps 기기(저전력 모드 등)에서도 게임 속도가 느려지지 않게 실제 경과 시간을 쓴다
    fps: { target: 60, smoothStep: false },
    scene: [BootScene, TitleScene, HubScene, RunScene, HudScene, MenuScene],
  });
  // 모든 장면이 같은 프레임의 입력을 읽도록 한 번만 갱신한다
  game.events.on('prestep', () => controls.snapshot());
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') sfx.toggleMute();
  });
  (window as unknown as { __dpv: unknown }).__dpv = { game, session, controls };
}

void main();

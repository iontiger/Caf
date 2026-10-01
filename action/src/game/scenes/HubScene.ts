import Phaser from 'phaser';
import { GIVERS, offerBoons, type Giver } from '../../logic/boons';
import { barkeepLine, buyUpgrade, CLUE_CAPTAIN, metaBonus, nextCost, UPGRADES } from '../../logic/meta';
import { Rng } from '../../logic/rng';
import { GROUND_Y, VIEW_H, VIEW_W } from '../../logic/run';
import { controls } from '../controls';
import { Bubble, FONT } from '../fx';
import { Player } from '../player';
import { sfx } from '../sfx';
import { currentStats, live, persist, session, startRun } from '../state';
import { openMenu, type MenuCard } from './MenuScene';

const TIPS = [
  '"도발이 길게 늘어지면 조심해. 말끝에 칼이 온다."',
  '"게는 옆으로 달려와. 구르기로 넘거나 받아쳐서 뒤집어 버려."',
  '"병 던지는 녀석 병은 받아치면 도로 날아간다고."',
  '"관중이 배꼽을 잡으면 필살 대사를 날려. O 키다."',
  '"아래 키를 누른 채 점프하면 발판 아래로 내려갈 수 있어."',
];

interface Spot {
  x: number;
  prompt: string;
  act: () => void;
}

/** 덴트포토 마을 술집. 쓰러지면 여기서 깨어난다 */
export class HubScene extends Phaser.Scene {
  private player!: Player;
  private spots: Spot[] = [];
  private barkeepBubble!: Bubble;
  private keeperBubble!: Bubble;
  private talkCount = 0;
  private leaving = false;

  constructor() {
    super('hub');
  }

  create(): void {
    this.leaving = false;
    this.talkCount = 0;
    live.prompt = '';
    const meta = session.meta;
    this.physics.world.setBounds(0, -200, VIEW_W, VIEW_H + 200);
    this.cameras.main.setBounds(0, 0, VIEW_W, VIEW_H);
    this.drawTavern();

    const ground = this.add.zone(VIEW_W / 2, GROUND_Y + 40, VIEW_W, 80);
    this.physics.add.existing(ground, true);

    const barkeep = this.add.image(190, GROUND_Y - 26, 'barkeep').setOrigin(0.5, 1).setDepth(3).setScale(1.3);
    this.drawCounter();
    const keeper = this.add.image(600, GROUND_Y, 'keeper').setOrigin(0.5, 1).setDepth(8).setFlipX(true);
    this.add.circle(626, GROUND_Y - 16, 18, 0xffe9a8, 0.25).setDepth(7);
    const door = this.add.image(892, GROUND_Y, 'door').setOrigin(0.5, 1).setDepth(6);
    this.label(190, GROUND_Y - 96, '술집 주인');
    this.label(600, GROUND_Y - 62, '등대지기 · 금니 강화');
    this.label(892, GROUND_Y - 112, '출항 → 부두');

    this.barkeepBubble = new Bubble(this, { x: barkeep.x, y: barkeep.y - 40, displayHeight: 60 }, '#2a1408', '#fff4e0');
    this.keeperBubble = new Bubble(this, { x: keeper.x, y: keeper.y - 24, displayHeight: 48 }, '#2a2408', '#fffbe0');

    this.player = new Player(this, 380, GROUND_Y - 30, currentStats());
    this.player.combatEnabled = false;
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, ground);
    this.cameras.main.setZoom(1.2);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1, 0, 40);

    this.spots = [
      { x: 190, prompt: 'E: 술집 주인과 이야기', act: () => this.talkBarkeep() },
      { x: 600, prompt: 'E: 금니로 강화하기', act: () => this.openUpgrades() },
      { x: 760, prompt: 'E: 단서 게시판 보기', act: () => this.openClues() },
      { x: door.x, prompt: 'E: 출항하기', act: () => this.depart() },
    ];

    this.cameras.main.fadeIn(400, 5, 6, 26);
    this.events.once('shutdown', () => {
      live.prompt = '';
      this.barkeepBubble.destroy();
      this.keeperBubble.destroy();
    });

    if (!meta.seenIntro) {
      this.time.delayedCall(350, () =>
        openMenu(this, {
          title: '덴트포토 마을의 비밀',
          subtitle:
            '웃음이 끊긴 덴트포토 마을. 언덕 위 저택의 사진사가 플래시를 터뜨릴 때마다 주민들의 미소가 사진 속으로 사라졌다.\n아울러도 찍혔지만, 술집 주인이 사진을 현상액에 담가 꺼내 주었다.\n찍혀도 다시 깨어날 수 있다. 부두의 깡패 선장부터 혼내 주자.',
          cards: [
            {
              title: '알겠어!',
              body: '말싸움으로 이기는 칼잡이가 되자.',
              onPick: () => {
                meta.seenIntro = true;
                persist();
                this.barkeepBubble.say(barkeepLine(meta), 5200);
              },
            },
          ],
        }),
      );
    } else {
      this.time.delayedCall(500, () => this.barkeepBubble.say(barkeepLine(meta), 5200));
    }
  }

  private label(x: number, y: number, s: string): void {
    this.add.text(x, y, s, { fontFamily: FONT, fontSize: '14px', color: '#ffe9a8', stroke: '#1a0e06', strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(9);
  }

  private drawTavern(): void {
    const g = this.add.graphics().setDepth(-50);
    g.fillGradientStyle(0x4a2c18, 0x4a2c18, 0x2a180c, 0x2a180c, 1).fillRect(0, 0, VIEW_W, GROUND_Y);
    g.lineStyle(2, 0x2a180c, 0.6);
    for (let y = 40; y < GROUND_Y; y += 44) g.lineBetween(0, y, VIEW_W, y);
    // 창문 너머 밤바다
    g.fillStyle(0x1a0e06).fillRect(64, 70, 172, 140);
    g.fillGradientStyle(0x120d3a, 0x120d3a, 0x3a2d6b, 0x3a2d6b, 1).fillRect(72, 78, 156, 124);
    g.fillStyle(0x1f2a5e).fillRect(72, 162, 156, 40);
    g.fillStyle(0xfff6dc).fillCircle(190, 108, 14);
    g.fillStyle(0x1a0e06).fillRect(147, 78, 6, 124).fillRect(72, 137, 156, 6);
    // 선반과 술병
    g.fillStyle(0x6b4423).fillRect(40, 250, 300, 8).fillRect(40, 310, 300, 8);
    const colors = [0x3d8a4a, 0x8a3d3d, 0xd8b26a, 0x3a5fb0];
    for (let i = 0; i < 12; i++) {
      g.fillStyle(colors[i % 4]);
      g.fillRect(52 + i * 24, 226, 10, 24).fillRect(55 + i * 24, 216, 4, 10);
      if (i % 2 === 0) g.fillRect(58 + i * 24, 288, 12, 22);
    }
    // 바닥
    g.fillStyle(0x5a3a22).fillRect(0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y);
    g.fillStyle(0x7a5230).fillRect(0, GROUND_Y, VIEW_W, 4);
    g.lineStyle(2, 0x2a180c, 0.7);
    for (let x = 0; x < VIEW_W; x += 72) g.lineBetween(x, GROUND_Y + 4, x, VIEW_H);
    // 등불
    for (const x of [300, 520, 700]) {
      this.add.circle(x, 60, 40, 0xffb347, 0.12).setDepth(-40);
      g.fillStyle(0x1a0e06).fillRect(x - 1, 0, 2, 44);
      g.fillStyle(0xffd36b).fillCircle(x, 52, 9);
    }

    // 벽에 걸린 마을 사진 (타이틀 그림)
    const photo = this.add.image(480, 160, 'title').setDepth(-30);
    photo.setDisplaySize(240, 135);
    const frame = this.add.graphics().setDepth(-31);
    frame.fillStyle(0xd8b26a).fillRect(352, 84, 256, 152);
    frame.fillStyle(0x6b4423).fillRect(356, 88, 248, 144);
    this.add.text(480, 248, '마을 사진. 그땐 모두 웃고 있었다.', { fontFamily: FONT, fontSize: '13px', color: '#e8d0a8' }).setOrigin(0.5, 0).setDepth(-30);

    // 조작법 칠판
    const board = this.add.graphics().setDepth(-30);
    board.fillStyle(0x6b4423).fillRect(366, 280, 228, 104);
    board.fillStyle(0x23302a).fillRect(372, 286, 216, 92);
    this.add
      .text(480, 292, '← → 이동   스페이스 점프 (2단)\nJ 공격   K 구르기   L 받아치기\nO 필살 대사   Q 럼병   E 대화\n↓ + 점프: 발판 아래로', {
        fontFamily: FONT, fontSize: '13px', color: '#e8f0e0', align: 'center', lineSpacing: 5,
      })
      .setOrigin(0.5, 0)
      .setDepth(-29);

    // 단서 게시판
    const cork = this.add.graphics().setDepth(-30);
    cork.fillStyle(0x6b4423).fillRect(700, 150, 120, 150);
    cork.fillStyle(0xb08a5a).fillRect(706, 156, 108, 138);
    const found = session.meta.clues.length;
    for (let i = 0; i < Math.max(1, found); i++) {
      cork.fillStyle(found ? 0xf8f4ea : 0x9a7a4a).fillRect(718 + (i % 2) * 46, 170 + Math.floor(i / 2) * 50, 38, 40);
      cork.fillStyle(0xc0392b).fillCircle(737 + (i % 2) * 46, 172 + Math.floor(i / 2) * 50, 3);
    }
    this.add.text(760, 306, `단서 ${found}개`, { fontFamily: FONT, fontSize: '13px', color: '#ffe9a8' }).setOrigin(0.5, 0).setDepth(-29);
  }

  private drawCounter(): void {
    const g = this.add.graphics().setDepth(4);
    g.fillStyle(0x6b4423).fillRect(40, GROUND_Y - 54, 300, 54);
    g.fillStyle(0x8a5a2b).fillRect(32, GROUND_Y - 62, 316, 12);
    g.lineStyle(2, 0x3a2414, 0.7);
    for (let x = 90; x < 340; x += 60) g.lineBetween(x, GROUND_Y - 50, x, GROUND_Y);
    g.fillStyle(0xd8b26a).fillRect(250, GROUND_Y - 80, 14, 18);
    g.fillStyle(0xf4efe6).fillRect(250, GROUND_Y - 84, 14, 5);
  }

  private talkBarkeep(): void {
    const meta = session.meta;
    const line = this.talkCount === 0 ? barkeepLine(meta) : TIPS[(this.talkCount - 1 + meta.runs) % TIPS.length];
    this.talkCount += 1;
    this.barkeepBubble.say(line, 4200);
    sfx.taunt();
  }

  private openUpgrades(): void {
    const meta = session.meta;
    const cards: MenuCard[] = UPGRADES.map((u) => {
      const level = meta.upgrades[u.id];
      const cost = nextCost(meta, u.id);
      return {
        title: `${u.name} ${level}/${u.costs.length}`,
        body: `${u.text}\n\n${cost === null ? '다 배웠다' : `금니 ${cost}개`}`,
        tag: '등대지기의 가르침',
        color: 0xfff1a8,
        disabled: cost === null || meta.teeth < cost,
        onPick: () => {
          if (buyUpgrade(meta, u.id)) {
            persist();
            this.keeperBubble.say('"좋아, 이제 좀 볼 만하군."', 1800);
            this.time.delayedCall(250, () => this.openUpgrades());
          }
        },
      };
    });
    cards.push({ title: '그만', body: '다음에 또 올게요.', color: 0x8a84b8, onPick: () => this.keeperBubble.say('"금니는 부두 녀석들 입에 많지."', 2000) });
    openMenu(this, { title: '등대지기의 금니 강화', subtitle: `가진 금니 ${meta.teeth}개. 쓰러져도 금니와 강화는 남습니다.`, cards });
  }

  private openClues(): void {
    const meta = session.meta;
    const has = meta.clues.includes(CLUE_CAPTAIN.id);
    openMenu(this, {
      title: '단서 게시판',
      subtitle: has ? '사진사의 비밀에 조금 다가갔다.' : '아직 붙은 단서가 없다. 부두의 깡패 선장이 뭔가 알고 있을 것 같다.',
      cards: [
        has
          ? { title: CLUE_CAPTAIN.title, body: CLUE_CAPTAIN.text, tag: '부두', color: 0xff9a7a, onPick: () => undefined }
          : { title: '???', body: '깡패 선장을 이기면 단서가 붙는다.', tag: '부두', color: 0x8a84b8, onPick: () => undefined },
      ],
    });
  }

  private depart(): void {
    if (this.leaving) return;
    this.leaving = true;
    const run = startRun();
    const go = () => {
      this.cameras.main.fadeOut(350, 5, 6, 26);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('run'));
    };
    if (!metaBonus(session.meta).startSmile) {
      go();
      return;
    }
    const rng = new Rng(run.seed + 99);
    const giver = rng.pick<Giver>(['barkeep', 'keeper', 'fishwife']);
    const offers = offerBoons(rng, giver, []);
    openMenu(this, {
      title: '출항 기념사진',
      subtitle: `${GIVERS[giver].name}이(가) 배웅하며 미소 하나를 빌려준다.`,
      cards: offers.map((b) => ({
        title: b.name,
        body: b.text,
        tag: `${GIVERS[b.giver].icon} ${GIVERS[b.giver].name}`,
        color: GIVERS[b.giver].color,
        onPick: () => {
          const before = currentStats().maxFace;
          run.boons.push(b.id);
          run.face += currentStats().maxFace - before;
          go();
        },
      })),
    });
  }

  update(): void {
    this.player.update();
    this.barkeepBubble.update();
    this.keeperBubble.update();
    live.prompt = '';
    if (this.leaving) return;
    let best: Spot | null = null;
    for (const s of this.spots) {
      if (Math.abs(this.player.x - s.x) < 56 && (!best || Math.abs(this.player.x - s.x) < Math.abs(this.player.x - best.x))) best = s;
    }
    if (best) {
      live.prompt = best.prompt;
      if (controls.justPressed('interact')) best.act();
    }
  }
}

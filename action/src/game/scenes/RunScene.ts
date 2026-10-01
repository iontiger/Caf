import Phaser from 'phaser';
import { boonById, GIVERS, offerBoons, type Giver } from '../../logic/boons';
import { CAPTAIN_DEFEAT, ENEMY_STATS, RETORTS } from '../../logic/enemies';
import { CLUE_CAPTAIN } from '../../logic/meta';
import { Rng } from '../../logic/rng';
import { doorRewards, GROUND_Y, SHOP_ITEMS, VIEW_H, VIEW_W, type EnemyType, type Reward, type RoomPlan } from '../../logic/run';
import { drawBackground, drawPlatform } from '../backgrounds';
import { controls } from '../controls';
import { Enemy, type EnemyCtx } from '../enemy';
import { Bubble, floatText, FONT, slash, sparks } from '../fx';
import { Player } from '../player';
import { sfx } from '../sfx';
import { addTeeth, currentStats, live, persist, session } from '../state';
import { openMenu, type MenuCard } from './MenuScene';

const FINISHERS = [
  '네 칼솜씨는 네 대사만큼이나 무디구나!',
  '사진사도 네 얼굴은 안 찍겠다!',
  '부두 갈매기들이 너 보고 웃고 있어!',
  '그 칼, 생선 가게에서 빌려 온 거지?',
];

const GIVER_LIST: Giver[] = ['barkeep', 'keeper', 'fishwife'];

interface Door {
  x: number;
  reward: Reward;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

function rewardLabel(r: Reward): string {
  switch (r.kind) {
    case 'smile':
      return `${GIVERS[r.giver].icon} ${GIVERS[r.giver].name}의 미소`;
    case 'gold':
      return '금화 주머니';
    case 'heal':
      return '럼주 한 잔 (체면 회복)';
    case 'teeth':
      return '금니 2개';
  }
}

function rewardColor(r: Reward): number {
  if (r.kind === 'smile') return GIVERS[r.giver].color;
  return r.kind === 'teeth' ? 0xfff6dc : r.kind === 'heal' ? 0xff9a7a : 0xffd36b;
}

export class RunScene extends Phaser.Scene {
  private player!: Player;
  private enemies: Enemy[] = [];
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private bottles!: Phaser.Physics.Arcade.Group;
  private room!: RoomPlan;
  private rng!: Rng;
  private waveIdx = 0;
  private waveSpawning = false;
  private cleared = false;
  private leaving = false;
  private ending = false;
  private doors: Door[] = [];
  private lastAttackId = 0;
  private boss: Enemy | null = null;
  private merchant: Phaser.GameObjects.Image | null = null;
  private merchantBubble: Bubble | null = null;
  private retort!: Bubble;
  private ground!: Phaser.GameObjects.Zone;
  private platformZones: Phaser.GameObjects.Zone[] = [];
  private killer: EnemyType = 'sailor';

  constructor() {
    super('run');
  }

  private get run() {
    return session.run!;
  }

  create(): void {
    const run = this.run;
    this.room = run.plan[run.roomIndex];
    this.rng = new Rng(run.seed * 31 + run.roomIndex * 7 + 1);
    this.enemies = [];
    this.doors = [];
    this.platformZones = [];
    this.waveIdx = 0;
    this.waveSpawning = false;
    this.cleared = false;
    this.leaving = false;
    this.ending = false;
    this.boss = null;
    this.merchant = null;
    this.merchantBubble = null;
    live.boss = null;
    live.prompt = '';

    const { layout } = this.room;
    const W = layout.width;
    this.physics.world.resume();
    this.physics.world.setBounds(0, -400, W, VIEW_H + 400);
    this.cameras.main.setBounds(0, 0, W, VIEW_H);
    drawBackground(this, layout.theme, W);

    this.ground = this.add.zone(W / 2, GROUND_Y + 40, W, 80);
    this.physics.add.existing(this.ground, true);
    for (const p of layout.platforms) {
      drawPlatform(this, layout.theme, p);
      const z = this.add.zone(p.x + p.w / 2, p.y + 7, p.w, 14);
      this.physics.add.existing(z, true);
      const body = z.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
      this.platformZones.push(z);
    }

    this.player = new Player(this, 70, GROUND_Y - 30, currentStats(), { onDodgeEnd: (p) => this.dodgeFlash(p) });
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.platformZones, undefined, () => this.time.now > this.player.dropUntil && this.player.body.velocity.y >= 0);
    this.retort = new Bubble(this, this.player, '#0d1036', '#e8f6ff');

    this.enemyGroup = this.physics.add.group({ collideWorldBounds: true });
    this.physics.add.collider(this.enemyGroup, this.ground);
    this.bottles = this.physics.add.group();
    // 그룹과 단일 물체의 충돌 콜백은 인자 순서가 바뀔 수 있어 병을 직접 고른다
    this.physics.add.collider(this.bottles, this.ground, (a, b) => this.shatter((a === this.ground ? b : a) as Phaser.Physics.Arcade.Image));

    this.cameras.main.setZoom(1.25);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, 0, 50);
    this.cameras.main.fadeIn(280, 5, 6, 26);
    this.events.once('shutdown', () => {
      live.prompt = '';
      this.retort.destroy();
      this.merchantBubble?.destroy();
    });

    if (this.room.kind === 'shop') this.setupShop();
    else if (this.room.kind === 'boss') this.setupBoss();
    else {
      this.time.delayedCall(500, () => this.spawnWave());
      if (this.room.kind === 'elite') this.time.delayedCall(700, () => this.banner('외팔이 갑판장 등장!', 1600, '#ff9a7a'));
    }
    if (run.roomIndex === 0) this.time.delayedCall(300, () => this.banner('부두로! 도발이 끝나는 순간 받아쳐라 (L)', 2600));
  }

  private banner(text: string, ms = 1800, color = '#ffd36b', size = 30): void {
    this.game.events.emit('banner', text, ms, color, size);
  }

  // ───────── 적 ─────────

  private ctx(): EnemyCtx {
    return {
      player: this.player,
      tells: session.meta.bossTells,
      canAttack: (e) => e.isBig || this.enemies.filter((o) => o !== e && o.alive && !o.isBig && o.busy).length < 2,
      throwBottle: (e) => this.throwBottle(e),
      cannons: (_e, n) => this.cannons(n),
      summon: (type, x) => this.spawnEnemy(type, x),
      stunnedPoisonMul: () => this.player.stats.stunnedPoisonMul,
      onDeath: (e) => this.onEnemyDeath(e),
    };
  }

  private spawnEnemy(type: EnemyType, x: number): Enemy {
    const W = this.room.layout.width;
    let sx = Phaser.Math.Clamp(x, 40, W - 40);
    // 아울러 코앞에 나타나지 않게 한다
    if (Math.abs(sx - this.player.x) < 140) sx = Phaser.Math.Clamp(this.player.x + (sx >= this.player.x ? 200 : -200), 40, W - 40);
    const h = ENEMY_STATS[type].height;
    const e = new Enemy(this, type, sx, GROUND_Y - h / 2 - 8, this.ctx());
    this.enemyGroup.add(e);
    this.enemies.push(e);
    sparks(this, sx, GROUND_Y - 10, 0xe8e0ff, 8);
    return e;
  }

  private spawnWave(): void {
    const waves = this.room.waves;
    if (this.waveIdx >= waves.length) return;
    if (this.waveIdx > 0) this.banner('또 몰려온다!', 1000, '#ff9a7a', 24);
    for (const s of waves[this.waveIdx]) this.spawnEnemy(s.type, s.x);
    this.waveIdx += 1;
    this.waveSpawning = false;
  }

  private onEnemyDeath(e: Enemy): void {
    const run = this.run;
    if (e.def.gold > 0) {
      run.gold += e.def.gold;
      floatText(this, e.x, e.y - 30, `+${e.def.gold} 금화`, '#ffd36b', 16);
      sfx.coin();
    }
    this.addLaughter(5);
    if (e.poisoned && this.player.stats.poisonBurst) {
      const burst = this.add.circle(e.x, e.y, 20, 0x7fe08a, 0.45).setDepth(30);
      this.tweens.add({ targets: burst, radius: 130, alpha: 0, duration: 380, onComplete: () => burst.destroy() });
      for (const o of this.enemies) {
        if (o !== e && o.alive && Math.abs(o.x - e.x) < 130) o.poison(Math.max(2, this.player.stats.poisonDps), 3000);
      }
    }
    if (e.type === 'bosun') this.banner('갑판장: "앵무새야... 도망쳐..."', 1600, '#e8e0ff', 22);
    if (e.type === 'captain') this.victory();
  }

  // ───────── 투사체 ─────────

  private throwBottle(e: Enemy): void {
    const b = this.physics.add.image(e.x + e.facing * 12, e.y - 18, 'bottle').setDepth(25);
    this.bottles.add(b);
    const T = 0.85;
    const g = this.physics.world.gravity.y;
    const tx = this.player.x;
    const ty = this.player.y - 6;
    b.setVelocity((tx - b.x) / T, (ty - b.y - 0.5 * g * T * T) / T);
    b.setAngularVelocity(e.facing * 720);
    b.setData('reflected', false);
    sfx.swing();
  }

  private shatter(b: Phaser.Physics.Arcade.Image): void {
    if (!b.active) return;
    sparks(this, b.x, b.y, b.getData('reflected') ? 0xffd36b : 0x3d8a4a, 8);
    b.destroy();
  }

  private updateBottles(playerRect: Phaser.Geom.Rectangle): void {
    for (const obj of this.bottles.getChildren().slice()) {
      const b = obj as Phaser.Physics.Arcade.Image;
      if (!b.active) continue;
      if (b.y > VIEW_H + 50) {
        b.destroy();
        continue;
      }
      const r = b.getBounds();
      if (b.getData('reflected')) {
        for (const e of this.enemies) {
          if (e.alive && Phaser.Geom.Intersects.RectangleToRectangle(r, e.getBounds())) {
            e.takeDamage(28, b.x, { heavy: true, unblockable: true });
            e.stun(900);
            sfx.hit();
            this.shatter(b);
            break;
          }
        }
        continue;
      }
      if (this.player.attackBox && Phaser.Geom.Intersects.RectangleToRectangle(r, this.player.attackBox)) {
        floatText(this, b.x, b.y - 10, '쨍그랑!', '#bfe8ff', 15);
        this.addLaughter(3);
        this.shatter(b);
        continue;
      }
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, playerRect)) {
        const now = this.time.now;
        if (!b.getData('touchAt')) b.setData('touchAt', now);
        if (!this.player.isParrying && !this.player.invulnerable && now - b.getData('touchAt') < 50) continue;
        const res = this.player.receive(10, b.x, true);
        if (res === 'parried') {
          sfx.parry();
          b.setData('reflected', true).setTint(0xffd36b);
          const thrower = this.enemies.find((e) => e.alive && e.type === 'thrower');
          const tx = thrower ? thrower.x : b.x - Math.sign(b.body!.velocity.x) * 400;
          const vx = Phaser.Math.Clamp((tx - b.x) * 1.4, -900, 900) || this.player.facing * 600;
          b.setVelocity(vx, -380);
          floatText(this, b.x, b.y - 24, '되받아치기!', '#bfe8ff', 18);
          this.addLaughter(15);
          this.hitstop(70);
        } else if (res === 'hit') {
          this.killer = 'thrower';
          this.hurtPlayer(10);
          this.shatter(b);
        }
      }
    }
  }

  private cannons(count: number): void {
    const W = this.room.layout.width;
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 300, () => {
        if (this.ending) return;
        const x = i === 0 ? this.player.x : Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-320, 320), 30, W - 30);
        const shadow = this.add.image(x, GROUND_Y + 2, 'shadow').setDepth(7).setScale(0.3).setAlpha(0.4);
        const warn = this.add.text(x, GROUND_Y - 20, '!', { fontFamily: FONT, fontSize: '22px', color: '#ff4d4d' }).setOrigin(0.5).setDepth(8);
        this.tweens.add({ targets: shadow, scale: 1.4, alpha: 0.85, duration: 900 });
        this.time.delayedCall(700, () => {
          const ball = this.add.image(x, -40, 'cannonball').setDepth(26);
          this.tweens.add({
            targets: ball,
            y: GROUND_Y - 10,
            duration: 220,
            ease: 'Quad.easeIn',
            onComplete: () => {
              ball.destroy();
              shadow.destroy();
              warn.destroy();
              this.explode(x);
            },
          });
        });
      });
    }
  }

  private explode(x: number): void {
    sparks(this, x, GROUND_Y - 10, 0xff9a3a, 16);
    const ring = this.add.circle(x, GROUND_Y - 10, 12, 0xffb347, 0.6).setDepth(30);
    this.tweens.add({ targets: ring, radius: 60, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    this.cameras.main.shake(120, 0.008);
    sfx.hurt();
    if (Math.abs(this.player.x - x) < 54 && this.player.body.bottom > GROUND_Y - 80) {
      if (this.player.receive(14, x, false) === 'hit') {
        this.killer = 'captain';
        this.hurtPlayer(14);
      }
    }
    for (const e of this.enemies) {
      if (e.alive && e.type !== 'captain' && Math.abs(e.x - x) < 54) e.takeDamage(20, x, { heavy: true, unblockable: true });
    }
  }

  // ───────── 전투 판정 ─────────

  private bodyRect(e: Enemy): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(e.body.x, e.body.y, e.body.width, e.body.height);
  }

  private playerRect(): Phaser.Geom.Rectangle {
    const b = this.player.body;
    return new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
  }

  private checkPlayerAttacks(): void {
    const p = this.player;
    if (p.attackId !== this.lastAttackId && p.state === 'attack') {
      this.lastAttackId = p.attackId;
      this.time.delayedCall(40, () => slash(this, p.x + p.facing * 22, p.y - 6, p.facing, p.attackHeavy));
    }
    const box = p.attackBox;
    if (!box) return;
    for (const e of this.enemies) {
      if (!e.alive || e.lastHitBy === p.attackId) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(box, this.bodyRect(e))) continue;
      e.lastHitBy = p.attackId;
      const dmg = e.takeDamage(p.attackDamage, p.x, { heavy: p.attackHeavy });
      if (dmg <= 0) continue;
      if (e.lastBlocked) {
        sparks(this, e.x - p.facing * 10, p.y - 8, 0x9aa4c8, 4);
        continue;
      }
      sfx.hit();
      sparks(this, e.x - p.facing * 6, p.y - 8, 0xffe9a8, p.attackHeavy ? 12 : 7);
      this.addLaughter(1);
      if (p.stats.poisonDps > 0) e.poison(p.stats.poisonDps, 3000);
      if (p.attackHeavy) {
        this.hitstop(55);
        this.cameras.main.shake(70, 0.004);
      }
    }
  }

  private checkEnemyAttacks(playerRect: Phaser.Geom.Rectangle): void {
    const now = this.time.now;
    for (const e of this.enemies) {
      if (!e.alive || e.hitConsumed) continue;
      const touching = !!e.hitbox && Phaser.Geom.Intersects.RectangleToRectangle(e.hitbox, playerRect);
      if (touching && !e.touchAt) e.touchAt = now;
      if (!e.touchAt) continue;
      // 닿은 뒤 70ms 안에 받아치기를 눌러도 인정한다. 그 사이 판정이 사라지면 그때 맞는다
      const ripe = !touching || now - e.touchAt >= 70;
      if (!this.player.isParrying && !this.player.invulnerable && !ripe) continue;
      e.hitConsumed = true;
      const res = this.player.receive(e.def.damage, e.x, true);
      if (res === 'parried') this.onParry(e);
      else if (res === 'hit') {
        this.killer = e.type;
        this.hurtPlayer(e.def.damage * (e.strikeHeavy ? 1.2 : 1));
      }
    }
  }

  private onParry(e: Enemy): void {
    const p = this.player;
    const s = p.stats;
    sfx.parry();
    sparks(this, (p.x + e.x) / 2, p.y - 10, 0xbfe8ff, 18);
    const flash = this.add.circle((p.x + e.x) / 2, p.y - 10, 10, 0xffffff, 0.8).setDepth(45);
    this.tweens.add({ targets: flash, radius: 46, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
    const stunned = e.parried(s.stunOnParryMs);
    e.takeDamage(25 * s.counterMul * (stunned ? 1 : 0.5), p.x, { heavy: true, unblockable: true });
    this.addLaughter(30 * s.laughterMul);
    if (s.healOnParry > 0) this.heal(s.healOnParry);
    this.retort.say(Phaser.Utils.Array.GetRandom(RETORTS) as string, 1300);
    floatText(this, p.x, p.y - 56, stunned ? '받아치기!' : '막았다!', '#bfe8ff', 20);
    this.hitstop(stunned ? 110 : 60);
    this.cameras.main.shake(90, 0.006);
  }

  private hitstop(ms: number): void {
    this.physics.world.pause();
    this.time.delayedCall(ms, () => this.physics.world.resume());
  }

  private addLaughter(n: number): void {
    const before = live.laughter;
    live.laughter = Phaser.Math.Clamp(live.laughter + n, 0, 100);
    if (before < 100 && live.laughter >= 100) this.banner('관중이 배꼽 잡는다! 필살 대사 준비 (O)', 1600, '#ffffff', 24);
  }

  private heal(n: number): void {
    const run = this.run;
    const max = this.player.stats.maxFace;
    const before = run.face;
    run.face = Math.min(max, run.face + n);
    if (run.face > before) floatText(this, this.player.x, this.player.y - 40, `+${Math.round(run.face - before)} 체면`, '#7fe08a', 16);
  }

  private hurtPlayer(dmg: number): void {
    const run = this.run;
    run.face -= Math.round(dmg);
    live.laughter = Math.max(0, live.laughter - 15);
    floatText(this, this.player.x, this.player.y - 40, `-${Math.round(dmg)}`, '#ff6b6b', 20);
    this.cameras.main.shake(110, 0.007);
    if (run.face > 0) return;
    if (this.player.stats.lastStand > run.lastStandUsed) {
      run.lastStandUsed += 1;
      run.face = Math.round(this.player.stats.maxFace * 0.3);
      this.player.revive();
      this.banner('"술집 문 닫기 전까진 못 쓰러져!" 한 번 더 버틴다', 2000, '#ffb347', 22);
      return;
    }
    run.face = 0;
    this.death();
  }

  private dodgeFlash(p: Player): void {
    if (!p.stats.flashOnDodge) return;
    const ring = this.add.circle(p.x, p.y, 16, 0xfff1a8, 0.7).setDepth(44);
    this.tweens.add({ targets: ring, radius: 130, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    for (const e of this.enemies) {
      if (e.alive && Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) < 130) e.stun(e.isBig ? 450 : 900);
    }
  }

  private finisher(): void {
    if (live.laughter < 100 || this.ending || this.player.state === 'dead') return;
    live.laughter = 0;
    sfx.finisher();
    this.player.invulnUntil = this.time.now + 1200;
    const line = Phaser.Utils.Array.GetRandom(FINISHERS) as string;
    this.banner(`아울러: "${line}"`, 1800, '#ffffff', 28);
    this.cameras.main.flash(260, 255, 230, 140);
    this.cameras.main.shake(260, 0.012);
    this.hitstop(260);
    const view = this.cameras.main.worldView;
    for (const e of this.enemies) {
      if (!e.alive || !view.contains(e.x, e.y)) continue;
      e.takeDamage(50, this.player.x, { heavy: true, unblockable: true });
      if (e.alive) e.stun(1800);
      sparks(this, e.x, e.y, 0xffd36b, 14);
    }
  }

  private drinkRum(): void {
    const run = this.run;
    if (run.rum <= 0 || run.face >= this.player.stats.maxFace || this.player.state === 'dead') return;
    run.rum -= 1;
    sfx.coin();
    this.heal(30);
  }

  // ───────── 방 진행 ─────────

  private updateProgress(): void {
    if (this.cleared || this.room.kind === 'shop' || this.room.kind === 'boss') return;
    if (this.enemies.some((e) => e.alive)) return;
    if (this.waveIdx < this.room.waves.length) {
      if (!this.waveSpawning && this.waveIdx > 0) {
        this.waveSpawning = true;
        this.time.delayedCall(650, () => this.spawnWave());
      }
      return;
    }
    if (this.waveIdx === 0) return;
    this.roomCleared();
  }

  private roomCleared(): void {
    this.cleared = true;
    const teeth = this.room.kind === 'elite' ? 3 : 1;
    addTeeth(teeth);
    floatText(this, this.player.x, this.player.y - 60, `+${teeth} 금니`, '#fff6dc', 20);
    this.banner('방 정리! 문으로 가자 →', 1600);
    this.spawnDoors();
  }

  private spawnDoors(): void {
    const run = this.run;
    const W = this.room.layout.width;
    const next = run.plan[run.roomIndex + 1]?.kind;
    const rewards = doorRewards(this.rng, next);
    const xs = rewards.length === 1 ? [W - 120] : [W - 290, W - 120];
    const nextLabel = next === 'boss' ? '깡패 선장의 배' : next === 'elite' ? '강적이 기다린다' : next === 'shop' ? '떠돌이 상인' : '';
    rewards.forEach((reward, i) => {
      const x = xs[i];
      const sprite = this.add.image(x, GROUND_Y, 'door').setOrigin(0.5, 1).setDepth(8).setAlpha(0);
      const color = rewardColor(reward);
      const glow = this.add.ellipse(x, GROUND_Y - 50, 90, 120, color, 0.18).setDepth(7);
      this.tweens.add({ targets: glow, alpha: 0.05, duration: 700, yoyo: true, repeat: -1 });
      const text = nextLabel ? `${rewardLabel(reward)}\n${nextLabel}` : rewardLabel(reward);
      const label = this.add
        .text(x, GROUND_Y - 112, text, { fontFamily: FONT, fontSize: '15px', color: '#' + color.toString(16).padStart(6, '0'), stroke: '#0d1036', strokeThickness: 4, align: 'center' })
        .setOrigin(0.5, 1)
        .setDepth(9)
        .setAlpha(0);
      this.tweens.add({ targets: [sprite, label], alpha: 1, duration: 400 });
      this.doors.push({ x, reward, sprite, label });
    });
  }

  private updateDoors(): void {
    if (this.leaving || this.doors.length === 0) return;
    const p = this.player;
    for (const d of this.doors) {
      if (Math.abs(p.x - d.x) < 20 && p.grounded && p.body.bottom > GROUND_Y - 4) {
        this.enterDoor(d);
        return;
      }
    }
  }

  private enterDoor(d: Door): void {
    this.leaving = true;
    this.player.combatEnabled = false;
    this.player.setVelocityX(0);
    const run = this.run;
    const r = d.reward;
    switch (r.kind) {
      case 'smile':
        this.offerSmile(r.giver, () => this.goNext());
        return;
      case 'gold': {
        const n = this.rng.int(25, 40);
        run.gold += n;
        sfx.coin();
        floatText(this, d.x, GROUND_Y - 120, `+${n} 금화`, '#ffd36b', 20);
        break;
      }
      case 'heal':
        this.heal(25);
        break;
      case 'teeth':
        addTeeth(2);
        floatText(this, d.x, GROUND_Y - 120, '+2 금니', '#fff6dc', 20);
        break;
    }
    this.time.delayedCall(450, () => this.goNext());
  }

  private offerSmile(giver: Giver, after: () => void): void {
    const run = this.run;
    const offers = offerBoons(this.rng, giver, run.boons);
    if (offers.length === 0) {
      run.gold += 40;
      this.banner(`${GIVERS[giver].name}: "줄 미소가 다 떨어졌네. 대신 금화 40!"`, 1800, '#ffd36b', 20);
      this.time.delayedCall(600, after);
      return;
    }
    const g = GIVERS[giver];
    const cards: MenuCard[] = offers.map((b) => ({
      title: b.name,
      body: b.text,
      tag: b.duo ? `합동 미소 · ${GIVERS[b.giver].name} + ${GIVERS[b.duo].name}` : `${GIVERS[b.giver].icon} ${GIVERS[b.giver].name}`,
      color: b.duo ? 0xff9ad5 : GIVERS[b.giver].color,
      onPick: () => {
        this.takeBoon(b.id);
        after();
      },
    }));
    openMenu(this, {
      title: `${g.icon} ${g.name}의 미소`,
      subtitle: '사진에서 되찾은 미소 하나를 고르세요. 그 주민이 아울러를 돕습니다.',
      cards,
    });
  }

  private takeBoon(id: string): void {
    const run = this.run;
    const before = this.player.stats.maxFace;
    run.boons.push(id);
    this.player.stats = currentStats();
    const gain = this.player.stats.maxFace - before;
    if (gain > 0) run.face += gain;
    this.banner(boonById(id).quote, 2600, '#e8e0ff', 20);
  }

  private goNext(): void {
    const run = this.run;
    run.roomIndex += 1;
    this.cameras.main.fadeOut(300, 5, 6, 26);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart());
  }

  // ───────── 상점 ─────────

  private setupShop(): void {
    const W = this.room.layout.width;
    this.cleared = true;
    const x = W / 2 - 60;
    this.add.rectangle(x + 10, GROUND_Y - 30, 150, 60, 0x5a3a22).setDepth(7);
    this.add.rectangle(x + 10, GROUND_Y - 62, 170, 10, 0x8a5a2b).setDepth(7);
    this.add.text(x + 10, GROUND_Y - 150, '떠돌이 상인', { fontFamily: FONT, fontSize: '16px', color: '#c89bff', stroke: '#0d1036', strokeThickness: 4 }).setOrigin(0.5).setDepth(9);
    this.merchant = this.add.image(x, GROUND_Y - 64, 'merchant').setOrigin(0.5, 1).setDepth(8);
    this.merchantBubble = new Bubble(this, { x, y: GROUND_Y - 90, displayHeight: 46 }, '#2a0f40', '#f4ecff');
    this.time.delayedCall(500, () => this.merchantBubble?.say('"사진사한테 미소 뺏긴 사람들 물건이야. 싸게 줄게."', 3200));
    this.spawnDoors();
  }

  private openShop(): void {
    const run = this.run;
    const cards: MenuCard[] = SHOP_ITEMS.map((item) => ({
      title: item.name,
      body: `${item.text}\n\n금화 ${item.price}`,
      tag: item.id === 'smile' ? '수상한 물건' : '상점',
      color: item.id === 'smile' ? 0xff9ad5 : 0xffd36b,
      disabled: run.gold < item.price,
      onPick: () => {
        run.gold -= item.price;
        if (item.id === 'heal') this.heal(35);
        else if (item.id === 'rum') run.rum += 1;
        else this.offerSmile(this.rng.pick(GIVER_LIST), () => undefined);
        if (item.id !== 'smile') this.merchantBubble?.say('"좋은 선택이야!"', 1400);
      },
    }));
    cards.push({ title: '그만 보기', body: '다음에 또 올게요.', color: 0x8a84b8, onPick: () => undefined });
    openMenu(this, { title: '떠돌이 상인의 좌판', subtitle: `가진 금화 ${run.gold}`, cards });
  }

  // ───────── 보스 ─────────

  private setupBoss(): void {
    this.player.combatEnabled = false;
    const boss = this.spawnEnemy('captain', 760);
    boss.hold(2600);
    boss.facing = -1;
    this.boss = boss;
    live.boss = { name: boss.def.name, hp: boss.hp, max: boss.def.hp };
    this.banner('부두의 깡패 선장', 2000, '#ff9a7a', 36);
    this.time.delayedCall(400, () => boss.say('"누가 내 배에 함부로 올라탔어?"', 1600));
    this.time.delayedCall(2000, () => boss.say('"말싸움이든 칼싸움이든, 덤벼라!"', 1500));
    if (session.meta.bossTells) this.time.delayedCall(2200, () => this.banner('지난번에 봤다: 말 중간에 칼이 나오면 노란 !! 표시', 2200, '#ffe66b', 20));
    this.time.delayedCall(2600, () => {
      this.player.combatEnabled = true;
    });
  }

  private updateBoss(): void {
    const b = this.boss;
    if (!b || !live.boss) return;
    live.boss.hp = Math.max(0, b.hp);
    if (b.alive && !b.phase2 && b.hp <= b.def.hp / 2) {
      b.enterPhase2();
      b.say('"포수들! 대포 준비! 게들도 나와라!"', 1800);
      this.banner('선장이 화났다! 대포 그림자를 피하라', 1800, '#ff9a7a', 26);
      this.time.delayedCall(700, () => {
        this.spawnEnemy('crab', 60);
        this.spawnEnemy('crab', 900);
      });
    }
  }

  private victory(): void {
    if (this.ending) return;
    this.ending = true;
    const run = this.run;
    const meta = session.meta;
    this.player.combatEnabled = false;
    for (const e of this.enemies) if (e.alive && e !== this.boss) e.takeDamage(999, e.x);
    this.cameras.main.flash(400, 255, 240, 200);
    this.boss?.say(CAPTAIN_DEFEAT, 4200);
    this.time.delayedCall(4400, () => {
      addTeeth(10);
      if (!meta.clues.includes(CLUE_CAPTAIN.id)) meta.clues.push(CLUE_CAPTAIN.id);
      run.clues.push(CLUE_CAPTAIN.id);
      meta.runs += 1;
      meta.wins += 1;
      meta.lastDeath = 'win';
      persist();
      openMenu(this, {
        title: '부두에 웃음이 돌아왔다!',
        subtitle: `단서 「${CLUE_CAPTAIN.title}」\n${CLUE_CAPTAIN.text}\n\n이번 판 금니 +${run.teethEarned} (가진 금니 ${meta.teeth}) · 미소 ${run.boons.length}개`,
        cards: [{ title: '술집으로 돌아가기', body: '다음 지역, 절벽 마을은 아직 만드는 중입니다.', onPick: () => this.toHub() }],
      });
    });
  }

  private death(): void {
    if (this.ending) return;
    this.ending = true;
    const run = this.run;
    const meta = session.meta;
    this.player.die();
    sfx.shutter();
    this.cameras.main.flash(300, 255, 255, 255);
    const firstTell = this.killer === 'captain' && !meta.bossTells;
    meta.runs += 1;
    meta.lastDeath = this.killer;
    if (this.killer === 'captain') meta.bossTells = true;
    persist();
    this.time.delayedCall(450, () => this.photoFrame());
    this.time.delayedCall(2300, () => {
      const lines = [
        `${run.roomIndex + 1}번째 방에서 ${ENEMY_STATS[this.killer].name}에게 체면을 잃었다.`,
        `이번 판 금니 +${run.teethEarned} (가진 금니 ${meta.teeth}). 금니는 그대로 남는다.`,
      ];
      if (firstTell) lines.push('선장의 버릇을 봤다. 다음부터 속임수 공격에 노란 !! 표시가 보인다.');
      openMenu(this, {
        title: '찰칵! 사진 속에 갇혔다',
        subtitle: lines.join('\n'),
        cards: [{ title: '현상액에서 깨어나기', body: '술집 주인이 사진을 현상액에 담가 꺼내 준다.', onPick: () => this.toHub() }],
      });
    });
  }

  private photoFrame(): void {
    // 쓰러진 아울러를 사진 틀 가운데에 담는다
    const view = this.cameras.main.worldView;
    const w = 340;
    const h = 210;
    const cx = Phaser.Math.Clamp(this.player.x, view.x + w / 2 + 20, view.right - w / 2 - 20);
    const cy = Phaser.Math.Clamp(this.player.y - 20, view.y + h / 2 + 24, view.bottom - h / 2 - 64);
    const c = this.add.container(cx, cy).setDepth(90);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.55);
    g.fillRect(-VIEW_W, -VIEW_H, VIEW_W * 2, VIEW_H - h / 2 - 16);
    g.fillRect(-VIEW_W, h / 2 + 60, VIEW_W * 2, VIEW_H);
    g.fillRect(-VIEW_W, -h / 2 - 16, VIEW_W - w / 2 - 16, h + 76);
    g.fillRect(w / 2 + 16, -h / 2 - 16, VIEW_W, h + 76);
    g.fillStyle(0xf8f4ea);
    g.fillRect(-w / 2 - 16, -h / 2 - 16, w + 32, 16);
    g.fillRect(-w / 2 - 16, h / 2, w + 32, 60);
    g.fillRect(-w / 2 - 16, -h / 2, 16, h);
    g.fillRect(w / 2, -h / 2, 16, h);
    const caption = this.add.text(0, h / 2 + 30, '찰칵! 아울러, 사진 속에 갇히다', { fontFamily: FONT, fontSize: '20px', color: '#3a2a4a' }).setOrigin(0.5);
    c.add([g, caption]);
    c.setScale(1.5).setAngle(4).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, angle: -3, alpha: 1, duration: 420, ease: 'Back.easeOut' });
  }

  private toHub(): void {
    session.run = null;
    live.boss = null;
    live.laughter = 0;
    this.scene.start('hub');
  }

  // ───────── 매 프레임 ─────────

  update(): void {
    const p = this.player;
    // 프레임이 크게 밀려 바닥을 뚫고 내려가면 바닥 위로 되돌린다
    if (p.body.bottom > GROUND_Y + 8) {
      p.body.reset(p.x, GROUND_Y - p.body.height / 2 - 4);
    }
    p.update();
    for (const e of this.enemies) e.update();
    this.enemies = this.enemies.filter((e) => e.active);
    this.retort.update();
    this.merchantBubble?.update();
    if (this.ending) {
      live.prompt = '';
      return;
    }
    const pr = this.playerRect();
    this.checkPlayerAttacks();
    this.checkEnemyAttacks(pr);
    this.updateBottles(pr);
    this.updateProgress();
    this.updateDoors();
    this.updateBoss();
    if (controls.justPressed('finisher')) this.finisher();
    if (controls.justPressed('item')) this.drinkRum();

    live.prompt = '';
    if (this.merchant && !this.leaving && Math.abs(p.x - this.merchant.x) < 70) {
      live.prompt = 'E: 둘러보기';
      if (controls.justPressed('interact')) this.openShop();
    }
  }
}

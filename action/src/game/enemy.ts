import Phaser from 'phaser';
import { CAPTAIN_FAKEOUT, ENEMY_STATS, type EnemyStats } from '../logic/enemies';
import type { EnemyType } from '../logic/run';
import { Bubble, FONT, floatText } from './fx';
import { sfx } from './sfx';

export type EState = 'spawn' | 'idle' | 'approach' | 'telegraph' | 'attack' | 'gap' | 'recover' | 'stunned' | 'hurt' | 'dead';

type StrikeKind = 'swing' | 'dash' | 'throw' | 'cannons';

interface Strike {
  kind: StrikeKind;
  /** 판정이 살아 있는 시간 */
  dur: number;
  range?: number;
  speed?: number;
  /** 다음 칼질까지 쉬는 시간 */
  gap?: number;
  heavy?: boolean;
}

interface Move {
  line: string | null;
  telegraph: number;
  strikes: Strike[];
  recover: number;
  /** 이 거리 안에 들어와야 시작한다 */
  reach: number;
  /** 말이 끝나기 전에 칼이 나오는 속임수. 예고 표시가 없다 */
  fakeout?: boolean;
}

/** 적이 장면에 부탁하는 일들 */
export interface EnemyCtx {
  readonly player: { x: number; y: number };
  readonly tells: boolean;
  canAttack(e: Enemy): boolean;
  throwBottle(e: Enemy): void;
  cannons(e: Enemy, count: number): void;
  summon(type: EnemyType, x: number): void;
  stunnedPoisonMul(): number;
  onDeath(e: Enemy): void;
}

const BIG: EnemyType[] = ['bosun', 'captain'];

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  readonly def: EnemyStats;
  hp: number;
  estate: EState = 'spawn';
  facing = -1;
  private stateAt = 0;
  private stateDur = 0;
  private nextMoveAt = 0;
  private pending: Move | null = null;
  private move: Move | null = null;
  private strikeIdx = 0;
  private moveCount = 0;
  phase2 = false;

  /** 지금 살아 있는 공격 판정 */
  hitbox: Phaser.Geom.Rectangle | null = null;
  hitId = 0;
  hitConsumed = false;
  /** 판정이 아울러에게 처음 닿은 시각. 늦은 받아치기를 조금 봐준다 */
  touchAt = 0;
  /** 받아치기로 막히면 기절하는 마지막 일격인가 */
  strikeFinal = false;
  strikeHeavy = false;
  lastHitBy = -1;
  /** 방금 맞은 칼을 막았는가 */
  lastBlocked = false;

  /** 연달아 휘청이지 않게 잠깐 버틴다 */
  private poiseUntil = 0;
  private poisonUntil = 0;
  private poisonDps = 0;
  private nextPoisonTick = 0;
  poisoned = false;

  private bubble: Bubble;
  private bang: Phaser.GameObjects.Text;
  private stars: Phaser.GameObjects.Text;
  private bar: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, readonly type: EnemyType, x: number, y: number, private ctx: EnemyCtx) {
    super(scene, x, y, type);
    this.def = ENEMY_STATS[type];
    this.hp = this.def.hp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(15);
    const tex = this.texture.getSourceImage();
    this.body.setSize(this.def.width, this.def.height).setOffset((tex.width - this.def.width) / 2, tex.height - this.def.height);
    this.bubble = new Bubble(scene, this, '#2a0f0f', '#fff4e0');
    this.bang = scene.add
      .text(x, y, '!', { fontFamily: FONT, fontSize: '30px', color: '#ff4d4d', stroke: '#0d1036', strokeThickness: 5 })
      .setOrigin(0.5, 1)
      .setDepth(52)
      .setVisible(false);
    this.stars = scene.add
      .text(x, y, '★ ★', { fontFamily: 'sans-serif', fontSize: '16px', color: '#ffe66b', stroke: '#0d1036', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(52)
      .setVisible(false);
    this.bar = scene.add.graphics().setDepth(51);
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 380 });
    this.setStateE('spawn', 450);
  }

  get alive(): boolean {
    return this.estate !== 'dead';
  }

  get isBig(): boolean {
    return BIG.includes(this.type);
  }

  get busy(): boolean {
    return this.estate === 'telegraph' || this.estate === 'attack' || this.estate === 'gap';
  }

  private setStateE(s: EState, dur = 0): void {
    this.estate = s;
    this.stateAt = this.scene.time.now;
    this.stateDur = dur;
  }

  private elapsed(): number {
    return this.scene.time.now - this.stateAt;
  }

  private faceToward(x: number): void {
    this.facing = x >= this.x ? 1 : -1;
  }

  say(line: string, ms = 1400): void {
    this.bubble.say(line, ms);
    sfx.taunt();
  }

  // ───────── 공격 패턴 ─────────

  private chooseMove(): Move {
    const d = this.def;
    const taunt = () => Phaser.Utils.Array.GetRandom(d.taunts) as string;
    this.moveCount += 1;
    switch (this.type) {
      case 'sailor':
        return { line: taunt(), telegraph: d.telegraphMs, reach: d.range * 0.8, recover: 750, strikes: [{ kind: 'swing', dur: 160, range: d.range, speed: 150 }] };
      case 'crab':
        return { line: Math.random() < 0.5 ? taunt() : null, telegraph: d.telegraphMs, reach: d.range, recover: 850, strikes: [{ kind: 'dash', dur: 520, speed: 360 }] };
      case 'thrower':
        return { line: taunt(), telegraph: d.telegraphMs, reach: d.range, recover: 950, strikes: [{ kind: 'throw', dur: 60 }] };
      case 'bosun':
        if (this.moveCount % 3 === 0) {
          return { line: '꽥! 돌격! (앵무새가 외친다)', telegraph: 650, reach: 520, recover: 1000, strikes: [{ kind: 'dash', dur: 620, speed: 430 }] };
        }
        return {
          line: taunt(), telegraph: d.telegraphMs, reach: d.range * 0.8, recover: 950,
          strikes: [
            { kind: 'swing', dur: 150, range: d.range, speed: 120, gap: 300 },
            { kind: 'swing', dur: 170, range: d.range + 12, speed: 200, heavy: true },
          ],
        };
      case 'captain': {
        const options: Array<() => Move> = [
          () => ({
            line: taunt(), telegraph: d.telegraphMs, reach: d.range * 0.8, recover: 1000,
            strikes: [
              { kind: 'swing', dur: 150, range: d.range, speed: 120, gap: 260 },
              { kind: 'swing', dur: 150, range: d.range, speed: 120, gap: 260 },
              { kind: 'swing', dur: 190, range: d.range + 24, speed: 240, heavy: true },
            ],
          }),
          () => ({ line: CAPTAIN_FAKEOUT, telegraph: 820, reach: d.range * 0.9, recover: 950, fakeout: true, strikes: [{ kind: 'swing', dur: 190, range: d.range + 16, speed: 260, heavy: true }] }),
          () => ({ line: '비켜라, 꼬맹이!', telegraph: 650, reach: 900, recover: 1050, strikes: [{ kind: 'dash', dur: 760, speed: 500 }] }),
        ];
        if (this.phase2) {
          options.push(() => ({ line: '포수들! 쏴라!', telegraph: 520, reach: 2000, recover: 1900, strikes: [{ kind: 'cannons', dur: 60 }] }));
        }
        return Phaser.Utils.Array.GetRandom(options)();
      }
    }
  }

  private startMove(m: Move): void {
    this.move = m;
    this.strikeIdx = 0;
    this.faceToward(this.ctx.player.x);
    this.setStateE('telegraph', m.telegraph);
    this.setVelocityX(0);
    if (m.line && !m.fakeout) this.say(m.line, m.telegraph + 500);
  }

  private startStrike(): void {
    const s = this.move!.strikes[this.strikeIdx];
    this.hitId += 1;
    this.hitConsumed = false;
    this.touchAt = 0;
    this.strikeFinal = this.strikeIdx === this.move!.strikes.length - 1;
    this.strikeHeavy = !!s.heavy || s.kind === 'dash';
    this.setStateE('attack', s.dur);
    this.faceToward(this.ctx.player.x);
    if (s.kind === 'swing') {
      this.setVelocityX(this.facing * (s.speed ?? 120));
      sfx.swing();
    } else if (s.kind === 'dash') {
      this.setVelocityX(this.facing * (s.speed ?? 360));
      sfx.dodge();
    } else if (s.kind === 'throw') {
      this.ctx.throwBottle(this);
    } else if (s.kind === 'cannons') {
      this.ctx.cannons(this, 6);
    }
  }

  /** 받아치기에 막혔다. 마지막 일격이면 기절, 아니면 튕겨 나기만 한다 */
  parried(stunMs: number): boolean {
    this.hitbox = null;
    this.hitConsumed = true;
    if (this.move?.fakeout) this.say('지금 말하는 중이잖아!', 1300);
    if (this.strikeFinal || !this.isBig) {
      this.stun(this.isBig ? stunMs * 0.7 : stunMs);
      return true;
    }
    this.setVelocityX(-this.facing * 160);
    return false;
  }

  stun(ms: number): void {
    if (!this.alive) return;
    this.hitbox = null;
    this.move = null;
    this.pending = null;
    this.bang.setVisible(false);
    this.setStateE('stunned', ms);
    this.setVelocityX(-this.facing * 120);
  }

  poison(dps: number, ms: number): void {
    if (!this.alive || dps <= 0) return;
    const now = this.scene.time.now;
    if (!this.poisoned) this.nextPoisonTick = now + 500;
    this.poisonDps = Math.max(this.poisonDps, dps);
    this.poisonUntil = Math.max(this.poisonUntil, now + ms);
    this.poisoned = true;
  }

  /** 맞았다. 실제로 깎인 체력을 돌려준다 */
  takeDamage(amount: number, fromX: number, opts: { heavy?: boolean; poison?: boolean; unblockable?: boolean } = {}): number {
    this.lastBlocked = false;
    if (!this.alive || this.estate === 'spawn') return 0;
    // 갑판장과 선장은 공격 뒤 빈틈이나 기절했을 때만 제대로 맞는다. 앞에서 오는 칼은 막는다
    const open = this.estate === 'recover' || this.estate === 'stunned' || this.estate === 'hurt';
    const guarding = this.isBig && !opts.poison && !opts.unblockable && !open;
    if (guarding && (fromX - this.x) * this.facing >= 0) {
      this.lastBlocked = true;
      const chip = Math.max(1, Math.round(amount * 0.15));
      this.hp -= chip;
      floatText(this.scene, this.x - this.facing * 4, this.y - this.displayHeight / 2, '막음', '#9aa4c8', 15);
      sfx.block();
      if (this.hp <= 0) this.die(fromX);
      return chip;
    }
    const dmg = Math.max(1, Math.round(amount * (this.estate === 'stunned' ? 1.5 : 1)));
    this.hp -= dmg;
    floatText(this.scene, this.x + Phaser.Math.Between(-10, 10), this.y - this.displayHeight / 2, String(dmg), opts.poison ? '#7fe08a' : opts.heavy ? '#ffd36b' : '#ffffff', opts.heavy ? 22 : 17);
    if (!opts.poison) {
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(60, () => this.alive && this.clearTint());
    }
    if (this.hp <= 0) {
      this.die(fromX);
      return dmg;
    }
    if (opts.poison) return dmg;
    const dir = this.x >= fromX ? 1 : -1;
    if (!this.isBig) {
      // 도발 중에는 버틴다. 맞으면서도 칼이 나오니 받아치거나 피해야 한다
      const canStagger = !this.busy && this.estate !== 'stunned' && this.scene.time.now >= this.poiseUntil;
      if (canStagger) {
        this.poiseUntil = this.scene.time.now + 800;
        this.hitbox = null;
        this.move = null;
        this.bang.setVisible(false);
        this.bubble.hide();
        this.setStateE('hurt', 230);
        this.setVelocity(dir * (opts.heavy ? 260 : 150), opts.heavy ? -160 : -60);
      } else if (this.estate === 'stunned') {
        this.setVelocityX(dir * 90);
      }
    } else if (opts.heavy && this.estate !== 'attack') {
      this.setVelocityX(dir * 60);
    }
    return dmg;
  }

  private die(fromX: number): void {
    this.setStateE('dead');
    this.hitbox = null;
    this.bubble.hide();
    this.bang.setVisible(false);
    this.stars.setVisible(false);
    this.bar.clear();
    this.clearTint();
    this.setTint(0x9a9a9a);
    const dir = this.x >= fromX ? 1 : -1;
    this.setVelocity(dir * 180, -220);
    this.ctx.onDeath(this);
    if (this.type !== 'captain') {
      this.scene.tweens.add({ targets: this, angle: dir * 90, alpha: 0, duration: 700, delay: 150, onComplete: () => this.destroy() });
    } else {
      this.scene.tweens.add({ targets: this, angle: dir * 80, duration: 600 });
    }
  }

  update(): void {
    if (!this.active) return;
    const now = this.scene.time.now;
    const p = this.ctx.player;
    const dx = p.x - this.x;
    const dist = Math.abs(dx);
    const t = this.elapsed();

    if (this.poisoned && this.alive) {
      if (now > this.poisonUntil) {
        this.poisoned = false;
        this.poisonDps = 0;
      } else if (now >= this.nextPoisonTick) {
        this.nextPoisonTick = now + 500;
        const mul = this.estate === 'stunned' ? this.ctx.stunnedPoisonMul() : 1;
        this.takeDamage(this.poisonDps * 0.5 * mul, this.x, { poison: true });
      }
    }

    this.bang.setVisible(false);
    switch (this.estate) {
      case 'spawn':
        this.setVelocityX(0);
        if (t > this.stateDur) {
          this.setStateE('idle');
          this.nextMoveAt = now + Phaser.Math.Between(250, 800);
        }
        break;
      case 'idle':
      case 'approach': {
        if (!this.pending && now >= this.nextMoveAt) this.pending = this.chooseMove();
        const m = this.pending;
        const want = m ? m.reach : this.def.range * 1.6;
        let vx = 0;
        if (this.type === 'thrower') {
          if (dist < 220) vx = -Math.sign(dx);
          else if (dist > (m ? m.reach : 420)) vx = Math.sign(dx);
        } else if (dist > want) {
          vx = Math.sign(dx);
        }
        // 마지막 공격 후 잠깐은 다가오지만 바짝 붙지는 않는다
        if (!m && this.type !== 'thrower' && dist < this.def.range * 1.4) vx = 0;
        this.setVelocityX(vx * this.def.speed);
        this.faceToward(p.x);
        if (vx !== 0) this.facing = vx > 0 ? 1 : -1;
        this.estate = vx !== 0 ? 'approach' : 'idle';
        const dyOk = this.type === 'thrower' || this.type === 'captain' || Math.abs(p.y - this.y) < 70;
        if (m && dist <= m.reach && dyOk && this.ctx.canAttack(this)) {
          this.pending = null;
          this.startMove(m);
        }
        break;
      }
      case 'telegraph': {
        const m = this.move!;
        this.setVelocityX(0);
        this.x += Math.sin(now / 25) * 0.6;
        if (m.fakeout && m.line) {
          // 대사를 한 글자씩 꺼내다가, 말이 끝나기 전에 칼이 나온다
          const head = m.line.split('...')[0] + '...';
          const n = Math.floor((head.length * t) / m.telegraph);
          this.bubble.say(head.slice(0, Math.max(1, n)), 500);
        }
        if (t > m.telegraph - 300) {
          if (!m.fakeout) this.showBang('!', '#ff4d4d');
          else if (this.ctx.tells) this.showBang('!!', '#ffe66b');
        }
        if (t >= m.telegraph) this.startStrike();
        break;
      }
      case 'attack': {
        const s = this.move!.strikes[this.strikeIdx];
        if (s.kind === 'swing') {
          this.setVelocityX(this.body.velocity.x * 0.85);
          // 바짝 붙으면 더 밀고 들어가지 않는다
          if (Math.abs(p.x - this.x) < 26) this.setVelocityX(0);
          const r = s.range ?? this.def.range;
          const half = this.def.width / 2;
          const x = this.facing > 0 ? this.x - half : this.x - r;
          this.hitbox = new Phaser.Geom.Rectangle(x, this.body.top - 6, r + half, this.def.height + 6);
        } else if (s.kind === 'dash') {
          this.hitbox = new Phaser.Geom.Rectangle(this.body.left - 4, this.body.top - 4, this.def.width + 8, this.def.height + 4);
          if (this.body.blocked.left || this.body.blocked.right) this.stateDur = 0;
        } else {
          this.hitbox = null;
        }
        if (t >= this.stateDur) {
          this.hitbox = null;
          if (s.kind === 'dash') this.setVelocityX(0);
          if (this.strikeIdx < this.move!.strikes.length - 1) {
            this.setStateE('gap', s.gap ?? 250);
          } else {
            this.setStateE('recover', this.move!.recover);
          }
        }
        break;
      }
      case 'gap':
        this.setVelocityX(this.body.velocity.x * 0.8);
        if (t > this.stateDur - 220) this.showBang('!', '#ff4d4d');
        if (t >= this.stateDur) {
          this.strikeIdx += 1;
          this.startStrike();
        }
        break;
      case 'recover':
        this.setVelocityX(this.body.velocity.x * 0.85);
        if (t >= this.stateDur) {
          this.move = null;
          this.setStateE('idle');
          this.nextMoveAt = now + Phaser.Math.Between(200, 700);
        }
        break;
      case 'hurt':
        this.setVelocityX(this.body.velocity.x * 0.9);
        if (t >= this.stateDur) {
          this.setStateE('idle');
          this.nextMoveAt = now + Phaser.Math.Between(150, 500);
        }
        break;
      case 'stunned':
        this.setVelocityX(this.body.velocity.x * 0.85);
        if (t >= this.stateDur) {
          this.setStateE('idle');
          this.nextMoveAt = now + 300;
        }
        break;
      case 'dead':
        this.setVelocityX(this.body.velocity.x * 0.95);
        break;
    }

    if (this.alive) {
      this.setFlipX(this.facing < 0);
      if (this.estate === 'stunned') this.setTint(0xbfd8ff);
      else if (this.poisoned) this.setTint(Math.floor(now / 120) % 2 ? 0x9be89b : 0xffffff);
      else if (this.estate === 'telegraph' && Math.floor(now / 70) % 2) this.setTint(0xffb08a);
      else if (!this.isTinted || this.tintTopLeft !== 0xffffff) this.clearTint();
    }
    const top = this.y - this.displayHeight / 2;
    this.bang.setPosition(this.x, top - 26);
    this.stars.setVisible(this.estate === 'stunned').setPosition(this.x + Math.sin(now / 90) * 4, top - 2);
    this.bubble.update();
    this.drawBar(top);
  }

  private showBang(s: string, color: string): void {
    this.bang.setText(s).setColor(color).setVisible(true);
  }

  private drawBar(top: number): void {
    this.bar.clear();
    if (!this.alive || this.type === 'captain' || this.hp >= this.def.hp) return;
    const w = this.isBig ? 60 : 36;
    this.bar.fillStyle(0x0d1036, 0.8).fillRect(this.x - w / 2 - 1, top - 9, w + 2, 6);
    this.bar.fillStyle(this.poisoned ? 0x7fe08a : 0xff6b6b).fillRect(this.x - w / 2, top - 8, (w * Math.max(0, this.hp)) / this.def.hp, 4);
  }

  /** 등장 연출 동안 가만히 있게 한다 */
  hold(ms: number): void {
    this.setStateE('spawn', ms);
  }

  enterPhase2(): void {
    this.phase2 = true;
    this.pending = null;
    if (!this.busy) this.nextMoveAt = 0;
  }

  destroy(fromScene?: boolean): void {
    this.bubble?.destroy();
    this.bang?.destroy();
    this.stars?.destroy();
    this.bar?.destroy();
    super.destroy(fromScene);
  }
}

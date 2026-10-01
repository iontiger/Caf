import Phaser from 'phaser';
import type { Stats } from '../logic/boons';
import { DOUBLE_JUMP_V, GROUND_Y, JUMP_V } from '../logic/run';
import { controls } from './controls';
import { sfx } from './sfx';

type State = 'normal' | 'attack' | 'dodge' | 'parry' | 'hurt' | 'dead';

const RUN_SPEED = 250;
const COYOTE_MS = 90;
const BUFFER_MS = 110;
const DODGE_MS = 280;
const DODGE_SPEED = 440;
const DODGE_COOLDOWN = 420;
const PARRY_FAIL_COOLDOWN = 420;
const HURT_MS = 260;
const INVULN_MS = 850;

const COMBO = [
  { dur: 240, from: 60, to: 150, damage: 12, lunge: 90, heavy: false },
  { dur: 240, from: 60, to: 150, damage: 12, lunge: 90, heavy: false },
  { dur: 340, from: 110, to: 210, damage: 22, lunge: 170, heavy: true },
];

export type ReceiveResult = 'parried' | 'ignored' | 'hit';

export interface PlayerHooks {
  onDodgeEnd?: (p: Player) => void;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  readonly sword: Phaser.GameObjects.Image;
  private parryRing: Phaser.GameObjects.Arc;
  state: State = 'normal';
  facing = 1;
  combatEnabled = true;

  private stateAt = 0;
  private lastGrounded = 0;
  private jumpBufferedAt = -1000;
  private jumpsLeft = 2;
  private wasGrounded = true;
  private comboStep = 0;
  private queued = false;
  private dodgeReadyAt = 0;
  private parryReadyAt = 0;
  invulnUntil = 0;
  /** 발판 아래로 내려가는 중이면 발판 충돌을 끈다 */
  dropUntil = 0;

  /** 현재 칼질 판정. 판정이 없으면 null */
  attackBox: Phaser.Geom.Rectangle | null = null;
  attackId = 0;
  attackDamage = 0;
  attackHeavy = false;

  constructor(scene: Phaser.Scene, x: number, y: number, public stats: Stats, private hooks: PlayerHooks = {}) {
    super(scene, x, y, 'aul');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(20);
    this.body.setSize(20, 44).setOffset(6, 4);
    this.body.setMaxVelocityY(900);
    this.sword = scene.add.image(x, y, 'sword').setOrigin(0.1, 0.5).setDepth(21);
    this.parryRing = scene.add.circle(x, y, 30).setStrokeStyle(3, 0xbfe8ff, 0.9).setDepth(22).setVisible(false);
  }

  private setState2(s: State): void {
    this.state = s;
    this.stateAt = this.scene.time.now;
  }

  private elapsed(): number {
    return this.scene.time.now - this.stateAt;
  }

  get grounded(): boolean {
    return this.body.blocked.down || this.body.touching.down;
  }

  get invulnerable(): boolean {
    return this.state === 'dodge' || this.scene.time.now < this.invulnUntil || this.state === 'dead';
  }

  get isParrying(): boolean {
    return this.state === 'parry';
  }

  /** 적의 공격이 닿았을 때. 받아치기 중이면 막고, 구르기 중이면 무시한다 */
  receive(damage: number, fromX: number, parryable: boolean): ReceiveResult {
    if (this.state === 'dead') return 'ignored';
    if (parryable && this.isParrying) {
      this.facing = fromX >= this.x ? 1 : -1;
      this.parryReadyAt = 0;
      this.setState2('normal');
      return 'parried';
    }
    if (this.invulnerable) return 'ignored';
    this.setState2('hurt');
    this.attackBox = null;
    this.invulnUntil = this.scene.time.now + INVULN_MS;
    const dir = this.x >= fromX ? 1 : -1;
    this.setVelocity(dir * 260, -260);
    this.setTintFill(0xff6b6b);
    this.scene.time.delayedCall(90, () => this.clearTint());
    sfx.hurt();
    void damage;
    return 'hit';
  }

  die(): void {
    this.setState2('dead');
    this.attackBox = null;
    this.setVelocity(0, -200);
    this.setTint(0x888888);
  }

  revive(): void {
    this.setState2('normal');
    this.clearTint();
    this.invulnUntil = this.scene.time.now + 1500;
  }

  update(): void {
    const now = this.scene.time.now;
    const grounded = this.grounded;
    if (grounded) {
      this.lastGrounded = now;
      this.jumpsLeft = 2;
      if (!this.wasGrounded) this.squash(1.18, 0.82);
    }
    this.wasGrounded = grounded;

    const left = controls.isDown('left');
    const right = controls.isDown('right');
    const move = (right ? 1 : 0) - (left ? 1 : 0);
    if (controls.justPressed('jump')) this.jumpBufferedAt = now;

    switch (this.state) {
      case 'normal':
        this.runAndJump(move, 1);
        if (this.combatEnabled) this.tryActions(move);
        break;
      case 'attack':
        this.updateAttack(move);
        break;
      case 'dodge':
        this.setVelocityX(this.facing * DODGE_SPEED);
        this.setAlpha(0.55);
        if (this.elapsed() > DODGE_MS) {
          this.setAlpha(1);
          this.setState2('normal');
          this.hooks.onDodgeEnd?.(this);
        }
        break;
      case 'parry':
        this.setVelocityX(this.body.velocity.x * 0.7);
        if (this.elapsed() > this.stats.parryWindowMs) {
          this.parryReadyAt = now + PARRY_FAIL_COOLDOWN;
          this.setState2('normal');
        }
        break;
      case 'hurt':
        if (this.elapsed() > HURT_MS) this.setState2('normal');
        break;
      case 'dead':
        this.setVelocityX(this.body.velocity.x * 0.9);
        break;
    }

    // 무적 중 깜빡임
    if (this.state !== 'dodge') this.setAlpha(now < this.invulnUntil && Math.floor(now / 80) % 2 === 0 ? 0.4 : 1);
    this.setFlipX(this.facing < 0);
    this.updateSword();
  }

  private runAndJump(move: number, speedMul: number): void {
    const now = this.scene.time.now;
    const target = move * RUN_SPEED * speedMul;
    const vx = this.body.velocity.x;
    this.setVelocityX(vx + (target - vx) * (this.grounded ? 0.35 : 0.18));
    if (move !== 0) this.facing = move;

    if (now - this.jumpBufferedAt < BUFFER_MS && controls.isDown('down') && this.grounded && this.body.bottom < GROUND_Y - 4) {
      this.dropUntil = now + 260;
      this.jumpBufferedAt = -1000;
    }
    if (now - this.jumpBufferedAt < BUFFER_MS) {
      const canGroundJump = now - this.lastGrounded < COYOTE_MS && this.jumpsLeft === 2;
      if (canGroundJump || this.jumpsLeft > 0) {
        const first = canGroundJump;
        this.setVelocityY(-(first ? JUMP_V : DOUBLE_JUMP_V));
        this.jumpsLeft = first ? 1 : this.jumpsLeft - 1;
        if (!first && this.jumpsLeft < 0) this.jumpsLeft = 0;
        this.jumpBufferedAt = -1000;
        this.squash(0.82, 1.18);
        sfx.jump();
      }
    }
    // 점프 키를 일찍 떼면 낮게 뛴다
    if (!controls.isDown('jump') && this.body.velocity.y < -260) this.setVelocityY(this.body.velocity.y * 0.85);
  }

  private tryActions(move: number): void {
    const now = this.scene.time.now;
    if (controls.justPressed('parry') && now >= this.parryReadyAt) {
      this.setState2('parry');
      if (move !== 0) this.facing = move;
      return;
    }
    if (controls.justPressed('dodge') && now >= this.dodgeReadyAt) {
      if (move !== 0) this.facing = move;
      this.dodgeReadyAt = now + DODGE_COOLDOWN;
      this.setState2('dodge');
      sfx.dodge();
      return;
    }
    if (controls.justPressed('attack')) {
      this.comboStep = 0;
      this.startSwing(move);
    }
  }

  private startSwing(move: number): void {
    if (move !== 0) this.facing = move;
    this.setState2('attack');
    this.queued = false;
    this.attackId += 1;
    const step = COMBO[this.comboStep];
    this.attackDamage = step.damage * this.stats.attackMul;
    this.attackHeavy = step.heavy;
    this.setVelocityX(this.facing * step.lunge);
    sfx.swing();
  }

  private updateAttack(move: number): void {
    const step = COMBO[this.comboStep];
    const t = this.elapsed();
    this.setVelocityX(this.body.velocity.x * 0.86);
    if (t >= step.from && t <= step.to) {
      const w = step.heavy ? 78 : 64;
      const x = this.facing > 0 ? this.x + 4 : this.x - 4 - w;
      this.attackBox = new Phaser.Geom.Rectangle(x, this.y - 30, w, 52);
    } else {
      this.attackBox = null;
    }
    if (controls.justPressed('attack') && t > 70) this.queued = true;
    // 공격 중에도 구르기와 받아치기로 끊을 수 있다
    if (controls.justPressed('dodge') || controls.justPressed('parry')) {
      this.attackBox = null;
      this.setState2('normal');
      this.tryActions(move);
      return;
    }
    if (t >= step.dur) {
      this.attackBox = null;
      if (this.queued && this.comboStep < COMBO.length - 1) {
        this.comboStep += 1;
        this.startSwing(move);
      } else {
        this.setState2('normal');
      }
    }
  }

  private updateSword(): void {
    const f = this.facing;
    let angle = 35;
    let ox = 8;
    let oy = 6;
    if (this.state === 'attack') {
      const step = COMBO[this.comboStep];
      const p = Phaser.Math.Clamp(this.elapsed() / step.to, 0, 1);
      angle = this.comboStep === 1 ? Phaser.Math.Linear(70, -110, p) : Phaser.Math.Linear(-110, 70, p);
      ox = 10;
      oy = -6;
    } else if (this.state === 'parry') {
      angle = -75;
      ox = 12;
      oy = -4;
    } else if (this.state === 'dodge' || this.state === 'dead') {
      angle = 80;
    }
    this.sword.setPosition(this.x + ox * f, this.y + oy);
    this.sword.setFlipX(f < 0);
    this.sword.setOrigin(f > 0 ? 0.1 : 0.9, 0.5);
    this.sword.setAngle(f > 0 ? angle : -angle);
    this.sword.setAlpha(this.alpha);
    this.parryRing.setPosition(this.x, this.y).setVisible(this.state === 'parry');
  }

  private squash(sx: number, sy: number): void {
    this.setScale(sx, sy);
    this.scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 140, ease: 'Quad.easeOut' });
  }

  destroy(fromScene?: boolean): void {
    this.sword.destroy();
    this.parryRing.destroy();
    super.destroy(fromScene);
  }
}

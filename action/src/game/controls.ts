export type Action = 'left' | 'right' | 'jump' | 'attack' | 'dodge' | 'parry' | 'finisher' | 'item' | 'interact' | 'down';

const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  KeyJ: 'attack', KeyZ: 'attack',
  KeyK: 'dodge', KeyX: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge',
  KeyL: 'parry', KeyC: 'parry',
  KeyO: 'finisher', KeyV: 'finisher',
  KeyQ: 'item', KeyU: 'item',
  KeyE: 'interact', Enter: 'interact',
};

/** 키보드와 화면 터치 버튼을 하나로 묶은 입력. 프레임마다 snapshot()으로 눌림을 읽는다 */
class Controls {
  private held = new Set<Action>();
  private virtualHeld = new Set<Action>();
  private pressed = new Set<Action>();
  private frame = new Set<Action>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.pressed.add(a);
      this.held.add(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.held.delete(a);
    });
    window.addEventListener('blur', () => this.held.clear());
  }

  virtual(a: Action, down: boolean): void {
    if (down) {
      if (!this.virtualHeld.has(a)) this.pressed.add(a);
      this.virtualHeld.add(a);
    } else {
      this.virtualHeld.delete(a);
    }
  }

  /** 이번 프레임에 새로 눌린 동작을 확정한다. 장면 update 맨 앞에서 한 번 부른다 */
  snapshot(): void {
    this.frame = this.pressed;
    this.pressed = new Set();
  }

  isDown(a: Action): boolean {
    return this.held.has(a) || this.virtualHeld.has(a);
  }

  justPressed(a: Action): boolean {
    return this.frame.has(a);
  }

  clear(): void {
    this.pressed.clear();
    this.frame.clear();
  }
}

export const controls = new Controls();

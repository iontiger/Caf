import './style.css';
import { cardDef, describeCard } from './game/cards';
import {
  canFinish,
  canPlay,
  endTurn,
  finisher,
  intentDamage,
  LAUGHTER_MAX,
  MOMENTUM_PER_TURN,
  playCard,
  startCombat,
  wouldCounter,
  type Combat,
} from './game/combat';
import { enemyDef } from './game/enemies';
import { CLUES, clueById, eventById, type Outcome } from './game/events';
import { findNode, NODE_INFO, reachable } from './game/map';
import { applyRunEnd, loadMeta, RUMORS, saveMeta, type MetaGain } from './game/meta';
import { Rng } from './game/rng';
import {
  addCard,
  applyOutcome,
  buy,
  canChoose,
  currentFloor,
  moveTo,
  newRun,
  pickEnemy,
  pickEvent,
  removeCard,
  restHeal,
  rewardCards,
  rewardGold,
  SHOP_HEAL_AMOUNT,
  SHOP_HEAL_PRICE,
  SHOP_REMOVE_PRICE,
  shopStock,
  treasure,
  upgradeCard,
  type ShopItem,
} from './game/run';
import { KIND_LABEL, type CardDef, type CardInstance, type MapNode, type Meta, type RunState } from './game/types';

type Screen =
  | { name: 'title' }
  | { name: 'intro' }
  | { name: 'map' }
  | { name: 'combat'; node: MapNode }
  | { name: 'reward'; gold: number; cards: CardDef[]; elite: boolean }
  | { name: 'event'; id: string; result: Outcome | null }
  | { name: 'shop'; items: ShopItem[]; removing: boolean; removed: boolean }
  | { name: 'tavern'; mode: 'choose' | 'upgrade' | 'done'; healed: number }
  | { name: 'treasure'; gold: number; card: CardDef }
  | { name: 'runEnd'; won: boolean; gain: MetaGain; floor: number }
  | { name: 'hub' };

const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();

const app = document.querySelector<HTMLDivElement>('#app')!;

let meta: Meta = loadMeta(storage);
let run: RunState | null = null;
let rng = new Rng(Date.now());
let combat: Combat | null = null;
let screen: Screen = { name: 'title' };
let seenEvents: string[] = [];
let overlay: 'deck' | 'notebook' | null = null;
let hitFlash = false;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

function go(next: Screen): void {
  screen = next;
  render();
}

// ---------- 화면 조각 ----------

function topbar(): string {
  if (!run) return '';
  return `<div class="topbar">
    <h2 class="logo">DentPhoto Village · 1막 부두</h2>
    <div class="stats">
      <span>😤 체면 ${run.face}/${run.maxFace}</span>
      <span>🪙 ${run.gold}</span>
      <span>📍 ${currentFloor(run)}/7칸</span>
      <span>🔎 단서 ${run.clues.length}</span>
      <button class="ghost" data-act="deck">덱 ${run.deck.length}장</button>
    </div>
  </div>`;
}

function cardHtml(card: CardInstance, opts: { act?: string; arg?: string | number; disabled?: boolean; match?: boolean } = {}): string {
  const d = cardDef(card.defId);
  const tag = d.tag ? `<span class="tag tag-${d.tag}">${d.tag === 'any' ? '모든 주제' : d.tag}</span>` : '';
  const cls = ['card', `k-${d.kind}`, card.upgraded ? 'upgraded' : '', opts.disabled ? 'disabled' : '', opts.match ? 'match' : '']
    .filter(Boolean)
    .join(' ');
  const act = opts.act && !opts.disabled ? `data-act="${opts.act}" data-arg="${opts.arg ?? ''}"` : '';
  return `<div class="${cls}" ${act}>
    <div class="cost">${d.cost}</div>
    <div class="cname">${esc(d.name)}</div>
    <div class="ckind">${KIND_LABEL[d.kind]} ${tag}</div>
    <div class="cline">“${esc(d.line)}”</div>
    <div class="cdesc">${esc(describeCard(card))}</div>
  </div>`;
}

function defAsInstance(d: CardDef): CardInstance {
  return { uid: -1, defId: d.id, upgraded: false };
}

// ---------- 화면 ----------

function titleView(): string {
  const hasRuns = meta.runs > 0;
  return `<div class="title-screen">
      <div class="menu">
        <button data-act="start">${hasRuns ? '다시 출항' : '항해 시작'}</button>
        ${hasRuns ? '<button class="ghost" data-act="hub">술집으로</button>' : ''}
      </div>
    </div>
    <p class="title-note">말싸움 덱빌딩 로그라이트 · 1막 데모 · 2026, 아울러가 만들었다.</p>`;
}

function introView(): string {
  return `<div class="parchment stack">
    <h2>프롤로그</h2>
    <p>100년 전, 전설의 해적 선장이 금니 하나를 남기고 사라진 뒤로 DentPhoto 마을은 밤마다 웃음소리가 끊이지 않는 항구가 되었다.</p>
    <p>그런데 요즘 주민들이 하나둘 이를 드러내고 웃지 못하게 되었다. 절벽 꼭대기 저택에서는 매일 밤 플래시가 번쩍인다.</p>
    <p>칼솜씨는 엉망이지만 말발만은 마을 최고인 견습 해적, <b>아울러</b>. 오늘 밤 부두에서 첫 말싸움이 시작된다.</p>
    <h3>말싸움 방법</h3>
    <ul>
      <li>상대가 다음에 할 <b>도발</b>을 미리 보여 준다. 도발에는 주제(<span class="tag tag-외모">외모</span> <span class="tag tag-용기">용기</span> <span class="tag tag-가문">가문</span> <span class="tag tag-실력">실력</span>)가 있다.</li>
      <li>같은 주제의 <b>응수</b> 카드를 내면 <b>받아치기</b>! 피해 2배에 도발이 무효가 되고 관중이 웃는다.</li>
      <li>주제가 틀리면 엉뚱한 소리가 되어 관중이 상대 편을 든다.</li>
      <li>관중 웃음 ${LAUGHTER_MAX}개가 모이면 <b>필살 대사</b>를 쓸 수 있다.</li>
      <li>보스는 주제를 숨긴다. 대사를 잘 듣고 짐작하자. 쓰러져도 술집에서 들은 소문과 단서는 남는다.</li>
    </ul>
    <div class="center"><button data-act="toMap">부두로 나간다</button></div>
  </div>`;
}

function mapView(): string {
  const r = run!;
  const open = new Set(reachable(r.map, r.at).map((n) => n.id));
  const floors = r.map.floors;
  const W = 420;
  const rowH = 86;
  const H = rowH * floors.length + 30;
  const pos = new Map<string, { x: number; y: number }>();
  floors.forEach((row, f) => {
    row.forEach((node, i) => {
      pos.set(node.id, { x: ((i + 1) * W) / (row.length + 1), y: H - 40 - f * rowH });
    });
  });
  const edges: string[] = [];
  const visited = new Set(r.visited);
  for (const row of floors) {
    for (const node of row) {
      for (const nextId of node.next) {
        const a = pos.get(node.id)!;
        const b = pos.get(nextId)!;
        const taken = visited.has(node.id) && visited.has(nextId);
        edges.push(`<line class="map-edge ${taken ? 'taken' : ''}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
      }
    }
  }
  const nodes = floors.flat().map((node) => {
    const p = pos.get(node.id)!;
    const cls = ['map-node', visited.has(node.id) ? 'visited' : '', node.id === r.at ? 'current' : '', open.has(node.id) ? 'open' : '']
      .filter(Boolean)
      .join(' ');
    const act = open.has(node.id) ? `data-act="enter" data-arg="${node.id}"` : '';
    const radius = node.type === 'boss' ? 30 : 22;
    return `<g class="${cls}" ${act}><circle cx="${p.x}" cy="${p.y}" r="${radius}"/><text x="${p.x}" y="${p.y}">${NODE_INFO[node.type].icon}</text></g>`;
  });
  const labels = `<text class="map-label" x="8" y="${H - 8}">부두 입구</text><text class="map-label" x="8" y="22">깡패 선장의 배</text>`;
  const legend = Object.values(NODE_INFO)
    .map((i) => `<span>${i.icon} ${i.label}</span>`)
    .join('');
  return `${topbar()}
    <div class="panel map-wrap">
      <p class="center dim">빛나는 칸을 눌러 다음으로 나아간다. 꼭대기의 깡패 선장을 이기면 1막 끝.</p>
      <svg class="map-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="1막 지도">${labels}${edges.join('')}${nodes.join('')}</svg>
      <div class="legend">${legend}</div>
    </div>`;
}

function intentHtml(c: Combat): string {
  const e = c.enemy;
  const intent = e.intent;
  if (!intent) return `<div class="bubble canceled">...할 말을 잊었다<div class="meta">이번 턴 행동 취소</div></div>`;
  if (intent.kind === 'taunt') {
    const tag = e.tagRevealed ? `<span class="tag tag-${intent.tag}">${intent.tag}</span>` : `<span class="tag tag-unknown">주제 ?</span>`;
    return `<div class="bubble">“${esc(intent.line)}”<div class="meta">도발 ${tag} 체면 피해 ${intentDamage(c)}</div></div>`;
  }
  if (intent.kind === 'bluff') return `<div class="bubble">${esc(intent.line)}<div class="meta">🛡️ 방어 ${intent.block}</div></div>`;
  return `<div class="bubble">${esc(intent.line)}<div class="meta">💢 도발 피해 +${intent.amount}</div></div>`;
}

function combatView(): string {
  const c = combat!;
  const e = c.enemy;
  const chips = [
    e.block ? `<span class="chip block">🛡️ 방어 ${e.block}</span>` : '',
    e.weak ? `<span class="chip weak">😵 약화 ${e.weak}</span>` : '',
    e.flustered ? `<span class="chip flustered">😳 당황 ${e.flustered}</span>` : '',
    e.strength ? `<span class="chip strength">💢 도발 +${e.strength}</span>` : '',
  ].join('');
  const rank = e.def.rank === 'boss' ? '<span class="rank">보스</span>' : e.def.rank === 'elite' ? '<span class="rank">엘리트</span>' : '';
  const log = c.log
    .slice(-4)
    .map((l) => `<p class="${l.kind}">${esc(l.text)}</p>`)
    .join('');
  const momentum = Array.from({ length: Math.max(MOMENTUM_PER_TURN, c.player.momentum) }, (_, i) =>
    `<i class="${i < c.player.momentum ? '' : 'spent'}"></i>`,
  ).join('');
  const laughter = Array.from({ length: LAUGHTER_MAX }, (_, i) => `<i class="${i < c.laughter ? 'on' : ''}">😂</i>`).join('');
  const hand = c.hand
    .map((card, i) =>
      cardHtml(card, {
        act: 'play',
        arg: i,
        disabled: !canPlay(c, i),
        match: e.tagRevealed && wouldCounter(c, card),
      }),
    )
    .join('');
  const ended = c.outcome
    ? `<div class="panel center stack"><div class="banner">${c.outcome === 'win' ? '말싸움 승리!' : '망신당했다...'}</div>
        <button data-act="combatDone">${c.outcome === 'win' ? '계속' : '술집으로 돌아간다'}</button></div>`
    : '';
  return `${topbar()}
    <div class="arena">
      <div class="panel enemy">
        <div class="portrait ${hitFlash ? 'hit' : ''}">${e.def.portrait}</div>
        <div>
          <div class="name">${esc(e.def.name)} ${rank}</div>
          <div class="bar"><i style="width:${(100 * e.face) / e.def.maxFace}%"></i><span>체면 ${e.face}/${e.def.maxFace}</span></div>
          <div class="chips">${chips}</div>
          ${c.outcome ? '' : intentHtml(c)}
        </div>
      </div>
      <div class="panel log">${log || '<p class="dim">말싸움 시작! 상대의 도발을 잘 듣자.</p>'}</div>
      ${ended}
      <div class="panel player">
        <div>
          <div class="name">아울러 <span class="dim" style="font-size:0.85rem">${c.turn}턴</span></div>
          <div class="bar me"><i style="width:${(100 * c.player.face) / c.player.maxFace}%"></i><span>체면 ${c.player.face}/${c.player.maxFace}</span></div>
          <div class="row">
            <div class="momentum">기세 ${momentum}</div>
            ${c.player.block ? `<span class="chip block">🛡️ 방어 ${c.player.block}</span>` : ''}
            <div class="laughter">관중 ${laughter}</div>
          </div>
        </div>
        <div class="stack">
          <button data-act="finisher" ${canFinish(c) ? '' : 'disabled'}>필살 대사</button>
          <button data-act="endTurn" ${c.outcome ? 'disabled' : ''}>턴 종료</button>
        </div>
      </div>
      <div class="hand">${c.outcome ? '' : hand}</div>
      <p class="center dim">뽑을 카드 ${c.draw.length} · 버린 카드 ${c.discard.length}${c.exhausted.length ? ` · 사라진 카드 ${c.exhausted.length}` : ''}</p>
    </div>`;
}

function rewardView(s: Extract<Screen, { name: 'reward' }>): string {
  const cards = s.cards.map((d, i) => cardHtml(defAsInstance(d), { act: 'takeReward', arg: i })).join('');
  return `${topbar()}
    <div class="panel stack center">
      <h2>전리품</h2>
      ${s.gold ? `<p>🪙 금화 ${s.gold}닢을 얻었다.</p>` : ''}
      <p>새 말솜씨를 하나 골라 덱에 넣는다.</p>
      <div class="grid-cards">${cards}</div>
      <button class="ghost" data-act="skipReward">넘어가기</button>
    </div>`;
}

function eventView(s: Extract<Screen, { name: 'event' }>): string {
  const ev = eventById(s.id);
  const body = s.result
    ? `<p><b>${esc(s.result.text)}</b></p>${outcomeSummary(s.result)}<div class="center"><button data-act="toMap">지도로</button></div>`
    : `<div class="choices">${ev.choices
        .map((ch, i) => {
          const ok = canChoose(run!, ch.outcome);
          return `<button data-act="choose" data-arg="${i}" ${ok ? '' : 'disabled'}>${esc(ch.label)}${ch.outcome.cost ? ` (금화 ${ch.outcome.cost})` : ''}</button>`;
        })
        .join('')}</div>`;
  return `${topbar()}
    <div class="parchment stack">
      <div class="scene">${ev.scene}</div>
      <h2 class="center">${esc(ev.title)}</h2>
      <p>${esc(ev.text)}</p>
      ${body}
    </div>`;
}

function outcomeSummary(o: Outcome): string {
  const parts: string[] = [];
  if (o.gold) parts.push(`금화 ${o.gold > 0 ? '+' : ''}${o.gold}`);
  if (o.face) parts.push(`체면 ${o.face > 0 ? '+' : ''}${o.face}`);
  if (o.maxFace) parts.push(`최대 체면 ${o.maxFace}`);
  if (o.card) parts.push(`카드 「${cardDef(o.card).name}」 획득`);
  if (o.clue) parts.push(`단서 「${clueById(o.clue)?.title}」`);
  return parts.length ? `<p class="dim">${parts.join(' · ')}</p>` : '';
}

function shopView(s: Extract<Screen, { name: 'shop' }>): string {
  const r = run!;
  if (s.removing) {
    const cards = r.deck.map((c) => cardHtml(c, { act: 'removeCard', arg: c.uid })).join('');
    return `${topbar()}<div class="panel stack center"><h2>어떤 카드를 버릴까?</h2><div class="grid-cards">${cards}</div>
      <button class="ghost" data-act="cancelRemove">그만두기</button></div>`;
  }
  const items = s.items
    .map(
      (it, i) => `<div>${cardHtml(defAsInstance(it.card), { act: 'buy', arg: i, disabled: it.sold || r.gold < it.price })}
        <div class="price">${it.sold ? '판매 완료' : `🪙 ${it.price}`}</div></div>`,
    )
    .join('');
  return `${topbar()}
    <div class="panel stack center">
      <div class="scene">💰</div>
      <h2>부두 잡화점</h2>
      <p class="dim">"말발도 사고팔 수 있다네. 물론 금화만 있다면."</p>
      <div class="grid-cards">${items}</div>
      <div class="row" style="justify-content:center">
        <button data-act="startRemove" ${s.removed || r.gold < SHOP_REMOVE_PRICE || r.deck.length <= 5 ? 'disabled' : ''}>카드 버리기 (🪙 ${SHOP_REMOVE_PRICE})</button>
        <button data-act="shopHeal" ${r.gold < SHOP_HEAL_PRICE || r.face >= r.maxFace ? 'disabled' : ''}>럼주 한 잔: 체면 +${SHOP_HEAL_AMOUNT} (🪙 ${SHOP_HEAL_PRICE})</button>
      </div>
      <button class="ghost" data-act="toMap">가게를 나선다</button>
    </div>`;
}

function tavernView(s: Extract<Screen, { name: 'tavern' }>): string {
  const r = run!;
  if (s.mode === 'upgrade') {
    const cards = r.deck
      .filter((c) => !c.upgraded)
      .map((c) => cardHtml(c, { act: 'upgrade', arg: c.uid }))
      .join('');
    return `${topbar()}<div class="panel stack center"><h2>어떤 말솜씨를 갈고닦을까?</h2>
      <p class="dim">강화하면 피해, 방어, 회복이 3씩 오른다.</p><div class="grid-cards">${cards}</div>
      <button class="ghost" data-act="tavernBack">돌아가기</button></div>`;
  }
  const body =
    s.mode === 'done'
      ? `<p>${s.healed ? `한숨 돌렸다. 체면 +${s.healed}.` : '말솜씨를 갈고닦았다.'}</p><button data-act="toMap">다시 나선다</button>`
      : `<div class="choices">
          <button data-act="rest">한숨 돌린다: 체면 30% 회복</button>
          <button data-act="tavernUpgrade">술꾼들과 입씨름 연습: 카드 1장 강화</button>
        </div>`;
  return `${topbar()}
    <div class="parchment stack">
      <div class="scene">🍻</div>
      <h2 class="center">부두 끝 작은 술집</h2>
      <p>선원들이 왁자지껄 떠드는 사이, 아울러는 구석 자리에 앉았다.</p>
      ${body}
    </div>`;
}

function treasureView(s: Extract<Screen, { name: 'treasure' }>): string {
  return `${topbar()}
    <div class="panel stack center">
      <div class="scene">🧰</div>
      <h2>낡은 궤짝</h2>
      <p>🪙 금화 ${s.gold}닢과 소품 하나가 들어 있다.</p>
      <div class="grid-cards">${cardHtml(defAsInstance(s.card))}</div>
      <button data-act="toMap">챙겨서 떠난다</button>
    </div>`;
}

function runEndView(s: Extract<Screen, { name: 'runEnd' }>): string {
  const lines: string[] = [];
  if (s.gain.rumor) lines.push(`<li>🍺 새 소문: ${esc(s.gain.rumor.text)}<br/><span class="dim">→ 카드 「${cardDef(s.gain.rumor.card).name}」이(가) 보상 카드에 나오기 시작한다.</span></li>`);
  for (const id of s.gain.newClues) lines.push(`<li>🔎 단서를 수첩에 적었다: 「${clueById(id)?.title}」</li>`);
  if (s.gain.bossRevealed) lines.push(`<li>☠️ ${enemyDef(s.gain.bossRevealed).name}의 말버릇을 파악했다. 다음부터 도발 주제가 보인다.</li>`);
  const title = s.won ? '1막 완료!' : '망신당하고 술집으로 실려 왔다';
  const text = s.won
    ? '깡패 선장을 말싸움으로 꺾었다. 이제 절벽 마을로 올라갈 차례다. (2막은 다음 버전에서 계속됩니다)'
    : `${s.floor}칸까지 나아갔다. 술집 주인이 물 한 잔을 내밀며 말한다. "또 왔구먼."`;
  return `<div class="parchment stack">
    <div class="banner">${title}</div>
    <p class="center">${text}</p>
    <ul>${lines.join('') || '<li>이번엔 새로 얻은 것이 없다.</li>'}</ul>
    <div class="center"><button data-act="hub">술집으로</button></div>
  </div>`;
}

function hubView(): string {
  const unlocked = RUMORS.filter((r) => meta.rumors.includes(r.id));
  return `<div class="parchment stack">
    <div class="scene">🍻</div>
    <h2 class="center">술집 「밤의 갈매기」</h2>
    <p class="center">항해 ${meta.runs}번 · 1막 완료 ${meta.wins}번 · 최고 ${meta.bestFloor}칸 · 단서 ${meta.clues.length}/${CLUES.length}</p>
    <h3>들은 소문</h3>
    <ul>${unlocked.map((r) => `<li>${esc(r.text)} <span class="dim">(「${cardDef(r.card).name}」)</span></li>`).join('') || '<li>아직 들은 소문이 없다.</li>'}</ul>
    <div class="row" style="justify-content:center">
      <button data-act="start">다시 출항</button>
      <button class="ghost" data-act="notebook" style="color:var(--parchment-ink);border-color:var(--parchment-ink)">수첩 보기</button>
      <button class="ghost" data-act="title" style="color:var(--parchment-ink);border-color:var(--parchment-ink)">타이틀로</button>
    </div>
  </div>`;
}

function overlayView(): string {
  if (overlay === 'deck' && run) {
    const cards = [...run.deck]
      .sort((a, b) => a.defId.localeCompare(b.defId))
      .map((c) => cardHtml(c))
      .join('');
    return `<div class="overlay"><div class="inner stack center"><h2>아울러의 덱 (${run.deck.length}장)</h2><div class="grid-cards">${cards}</div>
      <button data-act="closeOverlay">닫기</button></div></div>`;
  }
  if (overlay === 'notebook') {
    const items = CLUES.map((c) =>
      meta.clues.includes(c.id)
        ? `<li><b>${esc(c.title)}</b><br/>${esc(c.text)}</li>`
        : `<li class="locked">??? 아직 모르는 단서</li>`,
    ).join('');
    return `<div class="overlay"><div class="inner"><div class="parchment stack notebook"><h2>아울러의 수첩</h2>
      <p>단서 ${meta.clues.length}/${CLUES.length}. 모두 모으면 저택의 진실에 다가갈 수 있을 것 같다.</p><ul>${items}</ul>
      <div class="center"><button data-act="closeOverlay">닫기</button></div></div></div></div>`;
  }
  return '';
}

function render(): void {
  let html = '';
  switch (screen.name) {
    case 'title': html = titleView(); break;
    case 'intro': html = introView(); break;
    case 'map': html = mapView(); break;
    case 'combat': html = combatView(); break;
    case 'reward': html = rewardView(screen); break;
    case 'event': html = eventView(screen); break;
    case 'shop': html = shopView(screen); break;
    case 'tavern': html = tavernView(screen); break;
    case 'treasure': html = treasureView(screen); break;
    case 'runEnd': html = runEndView(screen); break;
    case 'hub': html = hubView(); break;
  }
  app.innerHTML = html + overlayView();
  hitFlash = false;
}

// ---------- 진행 ----------

function startRun(): void {
  const seed = Math.floor(Math.random() * 2 ** 31);
  run = newRun(seed);
  rng = new Rng(seed ^ 0x5bd1e995);
  seenEvents = [];
  combat = null;
  go(meta.runs === 0 ? { name: 'intro' } : { name: 'map' });
}

function enterNode(id: string): void {
  const r = run!;
  const node = findNode(r.map, id);
  if (!reachable(r.map, r.at).some((n) => n.id === id)) return;
  moveTo(r, node);
  switch (node.type) {
    case 'fight':
    case 'elite':
    case 'boss': {
      const enemy = enemyDef(pickEnemy(node, rng));
      combat = startCombat({
        enemy,
        deck: r.deck,
        face: r.face,
        maxFace: r.maxFace,
        rng,
        tagsKnown: meta.revealedBosses.includes(enemy.id),
      });
      go({ name: 'combat', node });
      break;
    }
    case 'event': {
      const evId = pickEvent(rng, seenEvents);
      seenEvents.push(evId);
      go({ name: 'event', id: evId, result: null });
      break;
    }
    case 'shop':
      go({ name: 'shop', items: shopStock(rng, meta), removing: false, removed: false });
      break;
    case 'tavern':
      go({ name: 'tavern', mode: 'choose', healed: 0 });
      break;
    case 'treasure': {
      const t = treasure(rng, r);
      go({ name: 'treasure', ...t });
      break;
    }
  }
}

function endRun(won: boolean): void {
  const r = run!;
  const node = screen.name === 'combat' ? screen.node : null;
  const floor = currentFloor(r);
  const gain = applyRunEnd(meta, {
    won,
    floor,
    clues: r.clues,
    lostToBoss: !won && node?.type === 'boss' && combat ? combat.enemy.def.id : null,
  });
  saveMeta(storage, meta);
  run = null;
  combat = null;
  go({ name: 'runEnd', won, gain, floor });
}

function combatDone(): void {
  const c = combat!;
  const r = run!;
  if (screen.name !== 'combat') return;
  const node = screen.node;
  if (c.outcome === 'lose') {
    endRun(false);
    return;
  }
  r.face = c.player.face;
  if (node.type === 'boss') {
    if (!r.clues.includes('c-captain')) r.clues.push('c-captain');
    endRun(true);
    return;
  }
  const gold = rewardGold(rng, node.type);
  r.gold += gold;
  go({ name: 'reward', gold, cards: rewardCards(rng, meta, node.type === 'elite'), elite: node.type === 'elite' });
}

function handle(act: string, arg: string): void {
  const r = run;
  switch (act) {
    case 'start': overlay = null; startRun(); return;
    case 'hub': overlay = null; go({ name: 'hub' }); return;
    case 'title': go({ name: 'title' }); return;
    case 'toMap': go({ name: 'map' }); return;
    case 'deck': overlay = 'deck'; render(); return;
    case 'notebook': overlay = 'notebook'; render(); return;
    case 'closeOverlay': overlay = null; render(); return;
    case 'enter': enterNode(arg); return;
    case 'play': {
      const c = combat!;
      const before = c.enemy.face;
      if (playCard(c, Number(arg))) {
        hitFlash = c.enemy.face < before;
        render();
      }
      return;
    }
    case 'finisher': if (finisher(combat!)) { hitFlash = true; render(); } return;
    case 'endTurn': endTurn(combat!); render(); return;
    case 'combatDone': combatDone(); return;
    case 'takeReward':
      if (screen.name === 'reward') addCard(r!, screen.cards[Number(arg)].id);
      go({ name: 'map' });
      return;
    case 'skipReward': go({ name: 'map' }); return;
    case 'choose': {
      if (screen.name !== 'event' || screen.result) return;
      const outcome = eventById(screen.id).choices[Number(arg)].outcome;
      if (!canChoose(r!, outcome)) return;
      applyOutcome(r!, outcome);
      go({ ...screen, result: outcome });
      return;
    }
    case 'buy':
      if (screen.name === 'shop' && buy(r!, screen.items[Number(arg)])) render();
      return;
    case 'startRemove': if (screen.name === 'shop') go({ ...screen, removing: true }); return;
    case 'cancelRemove': if (screen.name === 'shop') go({ ...screen, removing: false }); return;
    case 'removeCard':
      if (screen.name === 'shop' && r!.gold >= SHOP_REMOVE_PRICE) {
        r!.gold -= SHOP_REMOVE_PRICE;
        removeCard(r!, Number(arg));
        go({ ...screen, removing: false, removed: true });
      }
      return;
    case 'shopHeal':
      if (r!.gold >= SHOP_HEAL_PRICE) {
        r!.gold -= SHOP_HEAL_PRICE;
        r!.face = Math.min(r!.maxFace, r!.face + SHOP_HEAL_AMOUNT);
        render();
      }
      return;
    case 'rest': go({ name: 'tavern', mode: 'done', healed: restHeal(r!) }); return;
    case 'tavernUpgrade': go({ name: 'tavern', mode: 'upgrade', healed: 0 }); return;
    case 'tavernBack': go({ name: 'tavern', mode: 'choose', healed: 0 }); return;
    case 'upgrade': if (upgradeCard(r!, Number(arg))) go({ name: 'tavern', mode: 'done', healed: 0 }); return;
  }
}

app.addEventListener('click', (ev) => {
  const el = (ev.target as Element).closest<HTMLElement | SVGElement>('[data-act]');
  if (!el) return;
  handle(el.dataset.act!, el.dataset.arg ?? '');
});

render();

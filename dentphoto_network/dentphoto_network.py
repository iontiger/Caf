#!/usr/bin/env python3
"""덴트포토 게시판 작성자-댓글 작성자 관계 분석기.

게시판 목록을 넘기며 글마다 작성자와 댓글 작성자만 모은 뒤,
"누가 누구의 글에 댓글을 달았나"로 사람 사이의 관계를 계산한다.
글 제목과 본문은 수집하지 않는다.

사용법은 같은 폴더의 README.md 참고.
"""

import argparse
import csv
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BOARD_URL = "https://forum.dentphoto.com/board/{board}/"
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")

LIST_ROW_RE = re.compile(r'<tr class="tbtr">(.*?)</tr>', re.S)
LIST_LINK_RE = re.compile(r'<td class="bsubject">\s*<a href="([^"]+)"[^>]*>(.*?)</a>', re.S)
LIST_WRITER_RE = re.compile(r'class="wrtd">.*?>([^<]*)</a>', re.S)
POST_NUM_RE = re.compile(r'[?&]num=(\d+)')
TITLE_TIME_RE = re.compile(r'title="(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})"')
COMMENT_COUNT_RE = re.compile(r'\((\d+)\)$')
POST_INFO_RE = re.compile(r'<table id="c_info">(.*?)</table>', re.S)
POST_TIME_RE = re.compile(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}), 읽음')
MEMO_NICK_RE = re.compile(r"write_memo\('(.*?)'\)")
COMMENT_ROW_RE = re.compile(r'<tr class="cmt_hv" id="cop_(\d+)"[^>]*>(.*?)</tr>', re.S)
FIRST_TD_RE = re.compile(r'<td[^>]*>(.*?)<br', re.S)
TAG_RE = re.compile(r'<[^>]+>')
LOGIN_REDIRECT_MARK = "login_url="


class SessionExpired(Exception):
    """로그인 쿠키가 없거나 만료되어 로그인 페이지로 돌려보내진 경우."""


def clean(fragment):
    return html.unescape(TAG_RE.sub('', fragment)).strip()


# ---------------------------------------------------------------- 파싱

def parse_list(page):
    """목록 페이지에서 글번호, 링크, 작성자, 작성일시, 댓글 수를 뽑는다. 공지는 뺀다."""
    rows = []
    for row in LIST_ROW_RE.findall(page):
        if "notice.gif" in row:
            continue
        link = LIST_LINK_RE.search(row)
        writer = LIST_WRITER_RE.search(row)
        if not (link and writer):
            continue
        num = POST_NUM_RE.search(link.group(1))
        if not num:
            continue
        # 제목 끝의 "(3)"이 댓글 수. 새 글 표시(N)는 span이라 먼저 걷어낸다.
        title = clean(re.sub(r'<span.*?</span>', '', link.group(2), flags=re.S))
        count = COMMENT_COUNT_RE.search(title)
        written = TITLE_TIME_RE.search(row)
        rows.append({
            "num": int(num.group(1)),
            "url": html.unescape(link.group(1)),
            "author": clean(writer.group(1)),
            "date": written.group(1) if written else "",
            "comments": int(count.group(1)) if count else 0,
        })
    return rows


def parse_post(page):
    """글 페이지에서 작성자와 댓글 작성자 목록을 뽑는다. 글 페이지가 아니면 None."""
    info = POST_INFO_RE.search(page)
    if not info:
        return None
    author = MEMO_NICK_RE.search(info.group(1))
    written = POST_TIME_RE.search(info.group(1))
    comments = []
    for cid, block in COMMENT_ROW_RE.findall(page):
        nick = MEMO_NICK_RE.search(block)
        if nick:
            nick = html.unescape(nick.group(1)).strip()
        else:
            # 쪽지 링크가 없는 닉네임(탈퇴 회원 등)은 첫 칸의 글자를 그대로 쓴다.
            td = FIRST_TD_RE.search(block)
            nick = clean(re.sub(r'<font.*?</font>', '', td.group(1), flags=re.S)) if td else ""
        if not nick:
            continue
        at = TITLE_TIME_RE.search(block)
        comments.append({"id": int(cid), "nick": nick, "time": at.group(1) if at else ""})
    return {
        "author": html.unescape(author.group(1)).strip() if author else "",
        "date": written.group(1) if written else "",
        "comments": comments,
    }


# ---------------------------------------------------------------- 수집

class Fetcher:
    """로그인 쿠키를 붙여 페이지를 받는다. 요청 사이에 delay초 이상 쉰다."""

    def __init__(self, cookie, delay):
        self.cookie = cookie
        self.delay = delay
        self.last = 0.0
        self.count = 0  # 로그인된 상태로 받은 페이지 수

    def __call__(self, url):
        headers = {"User-Agent": USER_AGENT, "Cookie": self.cookie}
        for attempt in range(4):
            wait = self.delay - (time.monotonic() - self.last)
            if wait > 0:
                time.sleep(wait)
            self.last = time.monotonic()
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=30) as resp:
                    body = resp.read().decode("utf-8", errors="replace")
                break
            except urllib.error.HTTPError as e:
                if e.code not in (429, 500, 502, 503, 504) or attempt == 3:
                    raise
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                if attempt == 3:
                    raise
            time.sleep(10 * (attempt + 1))
        if LOGIN_REDIRECT_MARK in body and len(body) < 2000:
            raise SessionExpired()
        self.count += 1
        return body


def load_posts(path):
    """수집 기록(JSON Lines)을 읽는다. 같은 글이 여러 번 있으면 마지막 기록이 이긴다."""
    posts = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    rec = json.loads(line)
                    posts[rec["num"]] = rec
    return posts


def crawl(fetch, board_url, posts, cache_path, pages=None, start_page=1, since=None, log=print):
    """목록을 넘기며 처음 보는 글과 댓글이 늘어난 글만 읽어 posts와 기록 파일에 더한다.

    pages 페이지를 다 보거나, since(YYYY-MM-DD)보다 오래된 글만 남은 페이지에서 멈춘다.
    """
    page = start_page
    with open(cache_path, "a", encoding="utf-8") as cache:
        while pages is None or page < start_page + pages:
            rows = parse_list(fetch("{}list.php?gotopage={}".format(board_url, page)))
            if not rows:
                log("{}페이지에 글이 없어 수집을 마칩니다.".format(page))
                break
            in_range = [r for r in rows if not since or r["date"] >= since]
            read = 0
            for row in in_range:
                old = posts.get(row["num"])
                if old and (old.get("unreadable") or len(old["comments"]) >= row["comments"]):
                    continue
                rec = {"num": row["num"], "author": row["author"], "date": row["date"], "comments": []}
                if row["comments"]:
                    detail = parse_post(fetch(urllib.parse.urljoin(board_url, row["url"])))
                    read += 1
                    if detail is None:
                        rec["unreadable"] = True
                    else:
                        rec["author"] = detail["author"] or rec["author"]
                        rec["date"] = detail["date"] or rec["date"]
                        rec["comments"] = detail["comments"]
                posts[rec["num"]] = rec
                cache.write(json.dumps(rec, ensure_ascii=False) + "\n")
                cache.flush()
            log("[{}페이지] 글 {}개 중 기간 안 {}개, 새로 읽은 글 {}개 (모은 글 누적 {}개)".format(
                page, len(rows), len(in_range), read, len(posts)))
            if since and not in_range:
                log("{} 이전 글만 남아 수집을 마칩니다.".format(since))
                break
            page += 1


# ---------------------------------------------------------------- 분석

def analyze(posts):
    """글마다 (작성자, 댓글 단 사람들)을 모아 사람 사이 관계를 센다.

    한 글에 여러 번 댓글을 달아도 그 글에 대해서는 1번으로 센다.
    자기 글에 단 댓글은 관계에 넣지 않는다.
    """
    replies = Counter()  # (댓글 단 사람, 글쓴이) -> 댓글 단 글 수
    written = Counter()
    for post in posts:
        written[post["author"]] += 1
        for nick in {c["nick"] for c in post["comments"]} - {post["author"]}:
            replies[(nick, post["author"])] += 1

    pairs = []
    for a, b in {tuple(sorted(key)) for key in replies}:
        ab, ba = replies[(a, b)], replies[(b, a)]
        pairs.append({"a": a, "b": b, "a_to_b": ab, "b_to_a": ba,
                      "total": ab + ba, "mutual": min(ab, ba)})
    pairs.sort(key=lambda p: (-p["mutual"], -p["total"], p["a"], p["b"]))

    people = {}

    def person(nick):
        return people.setdefault(nick, {"nick": nick, "posts": 0, "gave": 0, "received": 0,
                                        "links": 0, "close": []})

    for nick, n in written.items():
        person(nick)["posts"] = n
    for (src, dst), n in replies.items():
        person(src)["gave"] += n
        person(dst)["received"] += n
    for p in pairs:
        for me, other in ((p["a"], p["b"]), (p["b"], p["a"])):
            person(me)["links"] += 1
            if p["mutual"]:
                person(me)["close"].append((p["mutual"], p["total"], other))
    for info in people.values():
        info["close"].sort(key=lambda c: (-c[0], -c[1], c[2]))
    ranked = sorted(people.values(), key=lambda p: (-len(p["close"]), -p["gave"] - p["received"], p["nick"]))
    return pairs, ranked


# ---------------------------------------------------------------- 결과 저장

def write_csv(path, header, rows):
    # 엑셀에서 한글이 깨지지 않도록 BOM을 붙인다.
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def write_reports(out_dir, posts, pairs, people, graph_max_edges):
    write_csv(os.path.join(out_dir, "pairs.csv"),
              ["순위", "사람A", "사람B", "A가 B 글에 댓글", "B가 A 글에 댓글", "합계", "끈끈함 점수", "관계"],
              [[i, p["a"], p["b"], p["a_to_b"], p["b_to_a"], p["total"], p["mutual"],
                "상호" if p["mutual"] else "일방"] for i, p in enumerate(pairs, 1)])

    write_csv(os.path.join(out_dir, "people.csv"),
              ["닉네임", "쓴 글", "댓글 단 글", "받은 댓글", "연결된 사람", "끈끈한 사람 수", "가장 끈끈한 사람"],
              [[p["nick"], p["posts"], p["gave"], p["received"], p["links"], len(p["close"]),
                ", ".join("{}({})".format(c[2], c[0]) for c in p["close"][:5])] for p in people])

    write_csv(os.path.join(out_dir, "posts.csv"),
              ["글번호", "작성일시", "작성자", "댓글 수", "댓글 단 사람"],
              [[p["num"], p["date"], p["author"], len(p["comments"]),
                ", ".join(dict.fromkeys(c["nick"] for c in p["comments"]))]
               for p in sorted(posts, key=lambda p: -p["num"])])

    dates = sorted(p["date"][:10] for p in posts if p["date"])
    data = {
        "edges": [{"a": p["a"], "b": p["b"], "ab": p["a_to_b"], "ba": p["b_to_a"], "mutual": p["mutual"]}
                  for p in pairs if p["mutual"]][:graph_max_edges],
        "meta": {"posts": len(posts), "people": len(people),
                 "from": dates[0] if dates else "", "to": dates[-1] if dates else "",
                 "generated": datetime.now().strftime("%Y-%m-%d %H:%M")},
    }
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    with open(os.path.join(out_dir, "network.html"), "w", encoding="utf-8") as f:
        f.write(GRAPH_HTML.replace("__DATA__", payload))


GRAPH_HTML = r"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>덴트포토 관계도</title>
<script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
<style>
:root { --bg:#f6f6f3; --panel:#ffffff; --text:#1f2328; --muted:#6b7280; --line:#e3e3de;
        --accent:#0f766e; --node:#14b8a6; --edge:#9aa5b1; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#111417; --panel:#191e23; --text:#e6e8eb; --muted:#98a2ae; --line:#2a3139;
          --accent:#2dd4bf; --node:#14b8a6; --edge:#56616d; }
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; display: flex; flex-direction: column; background: var(--bg); color: var(--text);
       font: 14px/1.5 -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; }
header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 24px; padding: 12px 16px;
         border-bottom: 1px solid var(--line); background: var(--panel); }
h1 { margin: 0; font-size: 17px; }
.meta, .hint { color: var(--muted); font-size: 13px; }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; margin-left: auto; }
.controls label { display: flex; align-items: center; gap: 8px; }
input[type=search] { width: 170px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px;
                     background: var(--bg); color: var(--text); font: inherit; }
input[type=range] { accent-color: var(--accent); }
main { flex: 1; min-height: 0; display: flex; }
#graph { flex: 1; min-width: 0; }
aside { width: 300px; padding: 14px 16px; overflow: auto; border-left: 1px solid var(--line); background: var(--panel); }
aside h2 { margin: 0 0 4px; font-size: 16px; }
table { width: 100%; margin-top: 10px; border-collapse: collapse; font-size: 13px; }
th, td { padding: 5px 4px; border-bottom: 1px solid var(--line); text-align: left; }
th { color: var(--muted); font-weight: 500; }
.n { text-align: right; font-variant-numeric: tabular-nums; }
tbody tr { cursor: pointer; }
tbody tr:hover { background: var(--bg); }
#error { display: none; padding: 24px 16px; }
@media (max-width: 760px) {
  main { flex-direction: column; }
  #graph { flex: none; height: 65vh; }
  aside { width: auto; border-left: 0; border-top: 1px solid var(--line); }
  .controls { margin-left: 0; }
}
</style>
</head>
<body>
<header>
  <div>
    <h1>덴트포토 관계도</h1>
    <div class="meta" id="meta"></div>
  </div>
  <div class="controls">
    <label>닉네임 <input type="search" id="search" list="nicks" placeholder="검색"></label>
    <datalist id="nicks"></datalist>
    <label>끈끈함 점수 <input type="range" id="min" min="1" step="1"> <b id="minv"></b> 이상</label>
    <span class="meta" id="count"></span>
  </div>
</header>
<p id="error">관계도 라이브러리를 불러오지 못했습니다. 인터넷에 연결된 상태에서 다시 열어 주세요.</p>
<main>
  <div id="graph"></div>
  <aside id="panel"><p class="hint">사람을 누르거나 닉네임을 검색하면 그 사람과 끈끈한 사람 목록이 여기에 나옵니다.<br><br>
  끈끈함 점수는 두 사람이 서로의 글에 댓글을 단 횟수 중 작은 쪽입니다. 선이 굵을수록 점수가 높습니다.</p></aside>
</main>
<script>
const DATA = __DATA__;
const $ = id => document.getElementById(id);
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const m = DATA.meta;
$("meta").textContent = `글 ${m.posts.toLocaleString()}개 · ${m.from} ~ ${m.to} · ${m.generated} 생성`;

const links = new Map();
for (const e of DATA.edges) {
  for (const [me, other, sent, got] of [[e.a, e.b, e.ab, e.ba], [e.b, e.a, e.ba, e.ab]]) {
    if (!links.has(me)) links.set(me, []);
    links.get(me).push({ other, mutual: e.mutual, sent, got });
  }
}
for (const list of links.values()) list.sort((x, y) => y.mutual - x.mutual || (y.sent + y.got) - (x.sent + x.got));
const nicks = [...links.keys()].sort((a, b) => a.localeCompare(b, "ko"));
for (const n of nicks) { const o = document.createElement("option"); o.value = n; $("nicks").appendChild(o); }

function showPerson(nick) {
  const panel = $("panel");
  panel.replaceChildren();
  const h = document.createElement("h2"); h.textContent = nick; panel.appendChild(h);
  const list = links.get(nick) || [];
  const p = document.createElement("div"); p.className = "meta";
  p.textContent = `끈끈한 사람 ${list.length}명`; panel.appendChild(p);
  const table = document.createElement("table");
  table.innerHTML = "<thead><tr><th>닉네임</th><th class='n'>점수</th><th class='n'>내가 댓글</th><th class='n'>받은 댓글</th></tr></thead>";
  const body = document.createElement("tbody");
  for (const l of list) {
    const tr = document.createElement("tr");
    for (const [v, cls] of [[l.other, ""], [l.mutual, "n"], [l.sent, "n"], [l.got, "n"]]) {
      const td = document.createElement("td"); td.textContent = v; if (cls) td.className = cls; tr.appendChild(td);
    }
    tr.addEventListener("click", () => focusNick(l.other));
    body.appendChild(tr);
  }
  table.appendChild(body); panel.appendChild(table);
}

let network = null, nodes = null, edges = null;
function focusNick(nick) {
  showPerson(nick);
  if (network && nodes.get(nick)) { network.selectNodes([nick]); network.focus(nick, { scale: 1.1, animation: true }); }
}

if (typeof vis === "undefined") {
  $("error").style.display = "block";
} else {
  nodes = new vis.DataSet(); edges = new vis.DataSet();
  network = new vis.Network($("graph"), { nodes, edges }, {
    nodes: { shape: "dot", scaling: { min: 6, max: 28, label: { enabled: true, min: 11, max: 20 } },
             color: { background: css("--node"), border: css("--accent"),
                      highlight: { background: css("--accent"), border: css("--text") } },
             font: { color: css("--text"), strokeWidth: 3, strokeColor: css("--bg") } },
    edges: { smooth: false, scaling: { min: 1, max: 9 },
             color: { color: css("--edge"), highlight: css("--accent"), opacity: 0.7 } },
    physics: { solver: "forceAtlas2Based", forceAtlas2Based: { gravitationalConstant: -60, springLength: 90 },
               stabilization: { iterations: 250 } },
    interaction: { hover: true, tooltipDelay: 150 },
  });

  function render(min) {
    const shown = DATA.edges.filter(e => e.mutual >= min);
    const degree = new Map();
    for (const e of shown) for (const n of [e.a, e.b]) degree.set(n, (degree.get(n) || 0) + 1);
    nodes.clear(); edges.clear();
    nodes.add([...degree].map(([n, d]) => ({ id: n, label: n, value: d, title: `${n}\n끈끈한 사람 ${d}명 (현재 기준)` })));
    edges.add(shown.map((e, i) => ({ id: i, from: e.a, to: e.b, value: e.mutual,
      title: `${e.a} → ${e.b} 글: ${e.ab}번\n${e.b} → ${e.a} 글: ${e.ba}번\n끈끈함 점수 ${e.mutual}` })));
    $("minv").textContent = min;
    $("count").textContent = `${degree.size}명 · 관계 ${shown.length}개`;
  }

  const max = DATA.edges.length ? DATA.edges[0].mutual : 1;
  const start = DATA.edges.length ? DATA.edges[Math.min(299, DATA.edges.length - 1)].mutual : 1;
  const slider = $("min");
  slider.max = Math.max(max, 1); slider.value = Math.max(start, 1);
  slider.addEventListener("input", () => render(+slider.value));
  render(+slider.value);
  network.on("selectNode", p => showPerson(p.nodes[0]));
  $("search").addEventListener("change", e => { if (links.has(e.target.value)) focusNick(e.target.value); });
}
</script>
</body>
</html>
"""


# ---------------------------------------------------------------- 실행

def read_cookie(args):
    cookie = args.cookie or os.environ.get("DENTPHOTO_COOKIE", "")
    path = args.cookie_file or os.path.join(SCRIPT_DIR, "cookie.txt")
    if not cookie and os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            cookie = f.read()
    cookie = cookie.strip()
    if cookie.lower().startswith("cookie:"):
        cookie = cookie[7:].strip()
    # PHPSESSID 값만 붙여넣은 경우
    if cookie and "=" not in cookie:
        cookie = "PHPSESSID=" + cookie
    return cookie


def main(argv=None):
    ap = argparse.ArgumentParser(description="덴트포토 게시판 작성자-댓글 작성자 관계 분석기")
    ap.add_argument("--board", default="free", help="게시판 이름 (기본: free = 자유게시판)")
    ap.add_argument("--pages", type=int, help="읽을 목록 페이지 수 (--since가 없으면 기본 5)")
    ap.add_argument("--start-page", type=int, default=1, help="시작할 목록 페이지 (기본 1)")
    ap.add_argument("--since", help="이 날짜(YYYY-MM-DD) 이후 글만 수집하고 분석")
    ap.add_argument("--delay", type=float, default=1.0, help="요청 사이 쉬는 시간(초, 기본 1)")
    ap.add_argument("--cookie", help="로그인 쿠키 (예: PHPSESSID=abc123)")
    ap.add_argument("--cookie-file", help="로그인 쿠키가 든 파일 (기본: 스크립트 옆 cookie.txt)")
    ap.add_argument("--out", default=os.path.join(SCRIPT_DIR, "output"), help="결과 폴더")
    ap.add_argument("--analyze-only", action="store_true", help="수집 없이 모아둔 데이터로 분석만")
    ap.add_argument("--graph-max-edges", type=int, default=2000, help="관계도에 넣을 최대 관계 수")
    args = ap.parse_args(argv)

    if args.since:
        try:
            datetime.strptime(args.since, "%Y-%m-%d")
        except ValueError:
            ap.error("--since는 2026-09-01 같은 형식이어야 합니다.")
    if args.pages is None and not args.since:
        args.pages = 5

    board_dir = os.path.join(args.out, args.board)
    os.makedirs(board_dir, exist_ok=True)
    cache_path = os.path.join(board_dir, "posts.jsonl")
    posts = load_posts(cache_path)

    if not args.analyze_only:
        cookie = read_cookie(args)
        if not cookie:
            print("로그인 쿠키가 없습니다. README.md의 '쿠키 준비' 부분을 참고해 cookie.txt를 만들어 주세요.")
            return 1
        fetch = Fetcher(cookie, args.delay)
        board_url = BOARD_URL.format(board=args.board)
        started = time.time()
        try:
            crawl(fetch, board_url, posts, cache_path, args.pages, args.start_page, args.since)
        except SessionExpired:
            if fetch.count == 0:
                print("로그인이 안 된 쿠키입니다. 브라우저에서 로그인한 뒤 쿠키를 새로 복사해 주세요.")
                return 1
            print("\n로그인이 만료됐습니다. 쿠키를 새로 복사한 뒤 같은 명령을 다시 실행하면 이어서 수집합니다.")
        except KeyboardInterrupt:
            print("\n중단했습니다. 지금까지 모은 글로 분석합니다. 같은 명령을 다시 실행하면 이어서 수집합니다.")
        except (urllib.error.URLError, OSError) as e:
            print("\n접속 오류로 멈췄습니다 ({}). 같은 명령을 다시 실행하면 이어서 수집합니다.".format(e))
        print("받은 페이지 {}개, {:.0f}초 걸림".format(fetch.count, time.time() - started))

    selected = [p for p in posts.values() if not args.since or p["date"] >= args.since]
    if not selected:
        print("분석할 글이 없습니다.")
        return 1
    pairs, people = analyze(selected)
    write_reports(board_dir, selected, pairs, people, args.graph_max_edges)

    mutual = [p for p in pairs if p["mutual"]]
    print("\n글 {}개, 사람 {}명, 관계 {}쌍 (그중 서로 댓글을 주고받은 끈끈한 관계 {}쌍)".format(
        len(selected), len(people), len(pairs), len(mutual)))
    for i, p in enumerate(mutual[:10], 1):
        print("  {:>2}. {} ↔ {}  점수 {} ({}→{} {}번, {}→{} {}번)".format(
            i, p["a"], p["b"], p["mutual"], p["a"], p["b"], p["a_to_b"], p["b"], p["a"], p["b_to_a"]))
    print("\n결과 폴더: {}".format(board_dir))
    print("  pairs.csv    두 사람씩 짝지은 관계 순위")
    print("  people.csv   사람별 요약과 가장 끈끈한 사람")
    print("  posts.csv    글별 작성자와 댓글 단 사람 (확인용)")
    print("  network.html 관계도 (브라우저로 열기)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

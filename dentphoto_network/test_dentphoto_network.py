"""dentphoto_network 테스트. 실행: python -m unittest test_dentphoto_network

실제 게시판 페이지와 같은 구조의 HTML을 가짜 닉네임으로 만들어 쓴다.
"""

import os
import tempfile
import unittest

import dentphoto_network as dn


def list_row(num, author, date, comments, notice=False):
    first = "<img src=/images/notice.gif>" if notice else str(num)
    count = " ({})".format(comments) if comments else ""
    return """
            <tr class="tbtr">
              <td style="width:50px;">
{first}              </td>
              <td style="width:100px;">일반</td>
              <td class="bsubject">
                <a href="list2content.php?num={num}&bnum=9{num}&gotopage=1&code=&column=&searchstring=">
제목 (괄호) 안 숫자 (7) 무시{count}&nbsp;<span style='color: #F00;'><sup>N</sup></span>                </a>
              </td>
              <td style="width:100px;" class="wrtd"><a href="javascript:void(0);" onclick="return confirm('{author} 님께')">{author}</a></td>
              <td style="width:100px;" title="{date}">{date}</td>
            </tr>""".format(first=first, num=num, author=author, date=date, count=count)


def post_page(author, commenters):
    rows = "".join("""
        <tr class="cmt_hv" id="cop_{cid}">
          <td class="setfont"><font style='color:#00F;'>♠</font><span onclick="write_memo('{nick}');">{nick}</span>
          <br><span class="setfont" title="2026-09-29 18:{m:02d}:00">18:{m:02d}:00</span>
          </td>
          <td class="qcomment"><span id="co_{cid}">내용</span></td>
        </tr>""".format(cid=100 + i, nick=nick, m=i) for i, nick in enumerate(commenters))
    return """<script>function write_memo(writer) {{}}</script>
    <table id="c_info">
      <tr><td class="c_left">작성자</td><td><span onclick="write_memo('{author}');">{author}</span></td></tr>
      <tr><td class="c_left">제목</td><td>1. 제목</td></tr>
      <tr><td class="c_left">작성일시</td><td>2026-09-29 18:00:00, 읽음 1, 추천 0</td></tr>
    </table>
    <table id="comment_list">{rows}</table>""".format(author=author, rows=rows)


class ParseTest(unittest.TestCase):
    def test_list_skips_notice_and_reads_comment_count(self):
        page = (list_row(1, "운영자", "2012-01-01 00:00:00", 58, notice=True)
                + list_row(12, "가나", "2026-09-29 18:25:05", 3)
                + list_row(11, "다라", "2026-09-29 18:00:00", 0))
        rows = dn.parse_list(page)
        self.assertEqual([(r["num"], r["author"], r["date"], r["comments"]) for r in rows],
                         [(12, "가나", "2026-09-29 18:25:05", 3), (11, "다라", "2026-09-29 18:00:00", 0)])
        self.assertTrue(rows[0]["url"].startswith("list2content.php?num=12&"))

    def test_post_reads_author_and_commenters(self):
        post = dn.parse_post(post_page("가나", ["다라", "가나", "마바"]))
        self.assertEqual(post["author"], "가나")
        self.assertEqual(post["date"], "2026-09-29 18:00:00")
        self.assertEqual([c["nick"] for c in post["comments"]], ["다라", "가나", "마바"])

    def test_non_post_page(self):
        self.assertIsNone(dn.parse_post("<script>alert('삭제된 글');</script>"))


class AnalyzeTest(unittest.TestCase):
    def test_example_from_request(self):
        # a의 글에 b, c, d가 댓글 / b의 글에 a, e가 댓글 -> a와 b만 서로 주고받음
        posts = [
            {"author": "a", "comments": [{"nick": n} for n in ["b", "c", "d", "b", "a"]]},
            {"author": "b", "comments": [{"nick": n} for n in ["a", "e"]]},
        ]
        pairs, people = dn.analyze(posts)
        by_pair = {(p["a"], p["b"]): p for p in pairs}
        self.assertEqual(pairs[0]["a"] + pairs[0]["b"], "ab")
        self.assertEqual(by_pair[("a", "b")]["mutual"], 1)
        # 같은 글에 두 번 달아도 1번으로 센다
        self.assertEqual(by_pair[("a", "b")]["b_to_a"], 1)
        self.assertEqual(by_pair[("a", "c")]["mutual"], 0)
        self.assertEqual(by_pair[("b", "e")]["a_to_b"], 0)
        self.assertEqual(by_pair[("b", "e")]["b_to_a"], 1)
        # 자기 글에 단 댓글은 관계가 아니다
        self.assertNotIn(("a", "a"), by_pair)
        a = next(p for p in people if p["nick"] == "a")
        self.assertEqual((a["posts"], a["gave"], a["received"], a["links"]), (1, 1, 3, 3))
        self.assertEqual([c[2] for c in a["close"]], ["b"])


class CrawlTest(unittest.TestCase):
    BOARD = "https://forum.dentphoto.com/board/free/"

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cache = os.path.join(self.tmp.name, "posts.jsonl")

    def tearDown(self):
        self.tmp.cleanup()

    def fake_site(self, lists, posts, requested):
        def fetch(url):
            requested.append(url)
            if "list.php" in url:
                return lists.get(int(url.rsplit("=", 1)[1]), "")
            return post_page(*posts[int(url.split("num=")[1].split("&")[0])])
        return fetch

    def test_since_stops_and_rerun_only_reads_changed_posts(self):
        lists = {
            1: list_row(3, "a", "2026-09-29 10:00:00", 2) + list_row(2, "b", "2026-09-28 10:00:00", 0),
            2: list_row(1, "c", "2026-09-20 10:00:00", 1),
            3: list_row(0, "d", "2026-09-19 10:00:00", 1),
        }
        site = {3: ("a", ["b", "c"]), 1: ("c", ["a"])}
        requested = []
        posts = {}
        dn.crawl(self.fake_site(lists, site, requested), self.BOARD, posts, self.cache,
                 since="2026-09-25", log=lambda *_: None)
        self.assertEqual(sorted(posts), [2, 3])
        self.assertEqual(posts[3]["comments"][1]["nick"], "c")
        self.assertEqual(len([u for u in requested if "list.php" in u]), 2)

        # 다시 돌리면 댓글이 늘어난 글만 읽는다
        lists[1] = list_row(3, "a", "2026-09-29 10:00:00", 3) + list_row(2, "b", "2026-09-28 10:00:00", 0)
        site[3] = ("a", ["b", "c", "d"])
        requested.clear()
        posts = dn.load_posts(self.cache)
        dn.crawl(self.fake_site(lists, site, requested), self.BOARD, posts, self.cache,
                 pages=1, log=lambda *_: None)
        self.assertEqual([u for u in requested if "list2content" in u],
                         [self.BOARD + "list2content.php?num=3&bnum=93&gotopage=1&code=&column=&searchstring="])
        self.assertEqual(len(dn.load_posts(self.cache)[3]["comments"]), 3)

    def test_session_expired_keeps_progress(self):
        def fetch(url):
            if "list.php" in url:
                return list_row(5, "a", "2026-09-29 10:00:00", 0) + list_row(4, "b", "2026-09-29 09:00:00", 1)
            raise dn.SessionExpired()
        posts = {}
        with self.assertRaises(dn.SessionExpired):
            dn.crawl(fetch, self.BOARD, posts, self.cache, pages=1, log=lambda *_: None)
        self.assertEqual(sorted(dn.load_posts(self.cache)), [5])


if __name__ == "__main__":
    unittest.main()

/**
 * 가짜 디시 페이지. 콘텐츠 스크립트가 보는 최소한의 마크업만 담는다 (디시가 마크업을 바꾸면 여기와 모듈을 같이 고친다).
 * fixtures.ts가 dcinside.com 주소를 이것으로 응답해 실제 디시에는 요청이 가지 않는다
 */

export interface FakeRow {
    no: number;
    title: string;
    nick: string;
    /** 유동은 빈 문자열 */
    uid: string;
    ip?: string;
    replies?: number;
}

export const ROWS: FakeRow[] = [
    {no: 3, title: "세 번째 글", nick: "고닉", uid: "user3", replies: 2},
    {no: 2, title: "두 번째 글", nick: "ㅇㅇ", uid: "", ip: "1.2"},
    {no: 1, title: "첫 번째 글", nick: "고닉", uid: "user1"}
];

const row = ({no, title, nick, uid, ip = "", replies}: FakeRow): string => `
<tr class="ub-content us-post" data-no="${no}" data-type="icon_txt">
  <td class="gall_num">${no}</td>
  <td class="gall_tit ub-word"><a href="/board/view/?id=test&no=${no}&page=1"><em class="icon_img icon_txt"></em>${title}</a>${replies ? `<a class="reply_numbox" href="/board/view/?id=test&no=${no}"><span class="reply_num">[${replies}]</span></a>` : ""}</td>
  <td class="gall_writer ub-writer" data-nick="${nick}" data-uid="${uid}" data-ip="${ip}"><span class="nickname"><em>${nick}</em></span>${uid ? "<a class=\"writer_nikcon\"><img src=\"https://nstatic.dcinside.com/dc/w/images/fix_nik.gif\"></a>" : `<span class="ip">(${ip})</span>`}</td>
  <td class="gall_date" title="2026-09-30 12:00:00">12:00</td>
  <td class="gall_count">10</td>
  <td class="gall_recommend">0</td>
</tr>`;

export const listPage = (rows: FakeRow[] = ROWS): string => `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>테스트 갤러리</title></head><body>
<div class="page_head"><h2><a href="/board/lists/?id=test">테스트 갤러리</a></h2><div class="gall_issuebox"></div></div>
<input type="hidden" id="e_s_n_o" value="token"><input type="hidden" id="gallery_id" value="test">
<div class="left_content"><article><div class="gall_listwrap">
<table class="gall_list"><thead><tr><th>번호</th><th>제목</th><th>글쓴이</th><th>작성일</th><th>조회</th><th>추천</th></tr></thead>
<tbody>${rows.map(row).join("")}</tbody></table>
<div class="bottom_paging_box"><em>1</em><a href="/board/lists/?id=test&page=2">2</a></div>
</div></article></div>
</body></html>`;

// 글 페이지는 미리보기가 받아 읽기도 하고, 좌클릭 이동으로 실제로 열리기도 한다. 열릴 때 아래 디시 스크립트가 쓰는 전역(_d, jQuery)을 흉내 낸다
export const viewPage = (no: string): string => `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>글 ${no}</title>
<script>window._d = () => ""; window.$ = () => ({data() {}});</script></head><body>
<input type="hidden" id="e_s_n_o" value="token">
<div class="view_content_wrap"><header><div class="gallview_head clear ub-content">
<h3 class="title ub-word"><span class="title_headtext">[말머리]</span><span class="title_subject">글 ${no} 제목</span></h3>
<div class="gall_writer ub-writer" data-nick="고닉" data-uid="user${no}" data-ip=""><span class="nickname"><em>고닉</em></span></div>
<div class="fr"><span class="gall_date" title="2026-09-30 12:00:00">2026.09.30 12:00:00</span><span class="gall_count">조회 10</span><span class="gall_reply_num">추천 1</span></div>
</div></header>
<div class="writing_view_box"><div class="write_div">본문 ${no} 내용입니다. <img src="https://dcimg1.dcinside.com/viewimage.php?id=test&no=${no}"></div></div>
</div>
<div class="cmt_write_box"><form id="focus_cmt"><input name="service_code" value="abc0123456789"></form></div>
<script id="reply-setting-tmpl" type="text/x-jquery-tmpl"></script><script>_d('');</script>
<script>$(document).data('comment_id', 'test'); $(document).data('comment_no', '${no}');</script>
</body></html>`;

export const commentsResponse = (): string => JSON.stringify({
    comments: [
        {no: "10", c_no: "10", depth: 0, user_id: "user1", name: "고닉", ip: "", memo: "댓글 하나", is_delete: "0", date_time: "2026.09.30 12:01:00", reg_date: "2026-09-30 12:01:00"},
        {no: "11", c_no: "10", depth: 1, user_id: "", name: "ㅇㅇ", ip: "1.2", memo: "답글", is_delete: "0", date_time: "2026.09.30 12:02:00", reg_date: "2026-09-30 12:02:00"}
    ],
    total_cnt: 2,
    pagination: "",
    allow_reply: 1
});

/** 1×1 gif */
export const GIF = Buffer.from("R0lGODlhAQABAAAAACw=", "base64");

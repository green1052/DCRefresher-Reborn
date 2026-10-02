/**
 * 가짜 디시 페이지. 콘텐츠 스크립트가 보는 최소한의 마크업만 담는다 (디시가 마크업을 바꾸면 여기와 모듈을 같이 고친다).
 * fixtures.ts가 dcinside.com 주소를 이것으로 응답해 실제 디시에는 요청이 가지 않는다.
 */

export interface FakeRow {
    no: number;
    title: string;
    nick: string;
    /** 유동은 빈 문자열. */
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

/** 글 페이지에 디시가 그려 둔 댓글 목록 (.cmt_list). 차단·같은 댓글 접기 같은 페이지 모듈이 본다. */
const pageCommentList = (comments: FakeComment[]): string => comments.length === 0 ? "" : `
<div class="comment_box"><ul class="cmt_list">${comments.map(({no, name, user_id, ip, memo}) => `
<li id="comment_li_${no}" class="ub-content"><div class="cmt_info clear">
<div class="cmt_nickbox"><span class="gall_writer ub-writer" data-nick="${name}" data-uid="${user_id}" data-ip="${ip}"><span class="nickname"><em>${name}</em></span></span></div>
<div class="clear cmt_txtbox"><p class="usertxt ub-word">${memo}</p></div></div></li>`).join("")}
</ul></div>`;

// 글 페이지는 미리보기가 받아 읽기도 하고, 좌클릭 이동으로 실제로 열리기도 한다. 열릴 때 아래 디시 스크립트가 쓰는 전역(_d, jQuery)을 흉내 낸다.
export const viewPage = (no: string, comments: FakeComment[] = []): string => `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>글 ${no}</title>
<script>window._d = () => ""; window.$ = () => ({data() {}});</script></head><body>
<input type="hidden" id="e_s_n_o" value="token">
<div class="view_content_wrap"><header><div class="gallview_head clear ub-content">
<h3 class="title ub-word"><span class="title_headtext">[말머리]</span><span class="title_subject">글 ${no} 제목</span></h3>
<div class="gall_writer ub-writer" data-nick="고닉" data-uid="user${no}" data-ip=""><span class="nickname"><em>고닉</em></span></div>
<div class="fr"><span class="gall_date" title="2026-09-30 12:00:00">2026.09.30 12:00:00</span><span class="gall_count">조회 10</span><span class="gall_reply_num">추천 1</span></div>
</div></header>
<div class="writing_view_box"><div class="write_div">본문 ${no} 내용입니다. <img src="https://dcimg1.dcinside.com/viewimage.php?id=test&no=${no}" width="40" height="40"></div></div>
</div>
${pageCommentList(comments)}
<div class="cmt_write_box"><form id="focus_cmt"><input name="service_code" value="${SERVICE_CODE}"></form></div>
<script id="reply-setting-tmpl" type="text/x-jquery-tmpl"></script><script>_d('${dValueFor(SERVICE_CODE_TAIL)}');</script>
<script>$(document).data('comment_id', 'test'); $(document).data('comment_no', '${no}');</script>
</body></html>`;

/** 댓글 목록 API(/board/comment/)가 주는 댓글. */
export interface FakeComment {
    no: string;
    /** 스레드 첫 댓글 번호. 첫 댓글이면 자기 번호다. */
    c_no: string;
    depth: 0 | 1;
    user_id: string;
    name: string;
    ip: string;
    memo: string;
    is_delete: "0" | "1";
    date_time: string;
    reg_date: string;
}

/** 댓글 하나. 시각은 순서대로 1분씩 뒤다. */
export const fakeComment = (no: number, fields: Partial<FakeComment> = {}): FakeComment => ({
    no: String(no), c_no: String(no), depth: 0, user_id: "", name: "ㅇㅇ", ip: "1.2", memo: `댓글 ${no}`, is_delete: "0",
    date_time: `2026.09.30 12:${String(no % 60).padStart(2, "0")}:00`, reg_date: `2026-09-30 12:${String(no % 60).padStart(2, "0")}:00`,
    ...fields
});

/** 기본 댓글: 고닉의 댓글 하나와 유동의 답글 하나. */
export const COMMENTS: FakeComment[] = [
    fakeComment(10, {user_id: "user1", name: "고닉", ip: "", memo: "댓글 하나"}),
    fakeComment(11, {c_no: "10", depth: 1, memo: "답글"})
];

export const commentsResponse = (comments: FakeComment[] = COMMENTS): string => JSON.stringify({
    comments,
    total_cnt: comments.length,
    pagination: "",
    allow_reply: 1
});

/* ===== 댓글 폼의 service_code ===== */

/** 글 페이지 댓글 폼의 service_code. 확장은 끝 10자리를 _d() 값으로 갈아 끼워 보낸다. */
const SERVICE_CODE = "abc0123456789";
/** _d() 값을 풀면 나오는 끝 10자리. 보낸 service_code는 "abc" + 이것이어야 한다. */
export const SERVICE_CODE_TAIL = "refresher!";

/**
 * 디시 _d()가 풀어 service_code 끝 10자리를 만드는 값을 거꾸로 만든다 (core/preview/request.ts의 submitComment가 푸는 방식의 역).
 * 글자 c(i번째)는 수 c·(12−i)/2 + i + 1이 되고, 수들을 쉼표로 잇고 첫 자리를 디시처럼 바꾼 뒤 섞은 base64로 쓴다.
 */
export function dValueFor(tail: string): string {
    const rKey = "yL/M=zNa0bcPQdReSfTgUhViWjXkYIZmnpo+qArOBs1Ct2D3uE4Fv5G6wHl78xJ9K";
    const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    const values = Array.from(tail, (c, i) => (c.charCodeAt(0) * (12 - i)) / 2 + i + 1).join(",");
    // 풀 때 첫 자리 f를 f>5면 f−5, 아니면 f+4로 바꾼다. 그 역 (첫 수는 6·c+1이라 0으로 시작하지 않는다).
    const first = Number(values[0]);
    const decoded = String(first <= 4 ? first + 5 : first - 4) + values.slice(1);
    return Array.from(btoa(decoded), (c) => rKey[b64.indexOf(c)]).join("");
}

/** 1×1 gif */
export const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

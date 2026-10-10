import type {Route} from "@playwright/test";

/**
 * 가짜 디시. fixtures.ts가 dcinside.com 요청을 모두 여기로 보내 실제 디시에는 아무것도 가지 않는다.
 * 콘텐츠 스크립트가 읽는 최소한의 마크업만 흉내 낸다. 디시 마크업이 바뀌어 모듈을 고치면 여기도 같이 고친다.
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
    reg_date: string;
    /** 음성 댓글이 아니면 디시는 null을 준다. */
    voice: null;
    /** "N"이면 디시가 답글쓰기를 두지 않는 댓글이다. */
    reply_w?: "Y" | "N";
}

/** 댓글 하나. 기본은 유동 ㅇㅇ(1.2)이다. */
export const fakeComment = (no: number, fields: Partial<FakeComment> = {}): FakeComment => ({
    no: String(no), c_no: String(no), depth: 0, user_id: "", name: "ㅇㅇ", ip: "1.2", memo: `댓글 ${no}`, is_delete: "0", voice: null,
    reg_date: `2026-09-30 12:${String(no % 60).padStart(2, "0")}:00`,
    ...fields
});

/** 미리보기 디시콘 창에 나오는 내 디시콘. */
export const DCCON = {package_idx: "7", detail_idx: "71", title: "웃음", list_img: "https://dcimg5.dcinside.com/dccon.php?no=71"};

/** 테스트 하나가 보는 가짜 디시. 테스트가 값을 바꾸면 다음 요청부터 그대로 응답한다. */
export class FakeSite {
    /** 1쪽 목록. 첫 행은 글 3(고닉 user3, 댓글 2개)이다. */
    rows: FakeRow[] = [
        {no: 3, title: "세 번째 글", nick: "고닉", uid: "user3", replies: 2},
        {no: 2, title: "두 번째 글", nick: "ㅇㅇ", uid: "", ip: "1.2"},
        {no: 1, title: "첫 번째 글", nick: "고닉", uid: "user1"}
    ];

    page2: FakeRow[] = [{no: 51, title: "2쪽 첫 글", nick: "고닉", uid: "user51"}];

    /** 글마다 같은 댓글: 고닉의 댓글 하나와 그 아래 유동의 답글 하나. */
    comments: FakeComment[] = [
        fakeComment(10, {user_id: "user1", name: "고닉", ip: "", memo: "댓글 하나"}),
        fakeComment(11, {c_no: "10", depth: 1, memo: "답글"})
    ];

    /** 글 페이지를 직접 열었을 때 디시가 그려 둔 댓글 (.cmt_list). */
    pageComments: FakeComment[] = [];

    /** 받은 쓰기 요청 (댓글 작성·삭제, 디시콘 댓글, 관리자 글 삭제). */
    readonly submitted: { path: string; body: URLSearchParams }[] = [];

    /**
     * 갤러리 관리자로 본다. 목록 머리와 행에 관리 체크박스 열을 그린다 (utils/user.ts의 isGalleryManager).
     * 디시가 주는 행에는 체크박스 칸이 없고 디시 JS가 붙인다 (core/list.ts). 여기서는 처음부터 넣어 둔다.
     */
    manager = false;

    /** 받은 1쪽 목록 요청 수 (페이지 문서 포함). */
    listRequests = 0;

    /** dcinside.com 요청에 응답한다 (context.route 처리기). */
    readonly handle = (route: Route): Promise<void> => {
        const request = route.request();
        const url = new URL(request.url());
        const html = (body: string) => route.fulfill({contentType: "text/html; charset=utf-8", body});
        const text = (body: string) => route.fulfill({contentType: "text/plain; charset=utf-8", body});
        const json = (body: unknown) => route.fulfill({contentType: "application/json", body: JSON.stringify(body)});
        const form = (): URLSearchParams => {
            const body = new URLSearchParams(request.postData() ?? "");
            this.submitted.push({path: url.pathname, body});
            return body;
        };

        switch (url.pathname) {
            case "/board/lists/":
            case "/board/lists": {
                const page = url.searchParams.get("page") ?? "1";
                if (page === "1") this.listRequests++;
                return html(listPage(page === "1" ? this.rows : this.page2, page, this.manager));
            }
            case "/board/view/":
                return html(viewPage(url.searchParams.get("no") ?? "", this.pageComments));
            // 디시가 요청이 많을 때 주는 임시 차단 페이지. 본문이 비어 있다.
            case "/board/write/":
                return html("<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
            case "/board/comment/":
                return json({comments: this.comments, total_cnt: this.comments.length, pagination: "", allow_reply: 1});
            case "/board/forms/comment_submit": {
                // 디시처럼 새 댓글 번호를 돌려주고 목록에 넣는다.
                const body = form();
                const parent = body.get("c_no");
                const no = this.nextCommentNo();
                this.comments.push(fakeComment(no, {c_no: parent ?? String(no), depth: parent ? 1 : 0, name: body.get("name") ?? "", memo: body.get("memo") ?? ""}));
                return text(String(no));
            }
            case "/dccon/insert_icon": {
                const body = form();
                this.comments.push(fakeComment(this.nextCommentNo(), {name: body.get("name") ?? "", memo: `<img class="written_dccon" src="${DCCON.list_img}" alt="${DCCON.title}">`}));
                return text("ok");
            }
            case "/board/comment/comment_delete_submit": {
                const target = this.comments.find((comment) => comment.no === form().get("re_no"));
                if (target) target.is_delete = "1";
                return text(target ? "true" : "false||댓글이 없습니다.");
            }
            case "/ajax/minor_manager_board_ajax/delete_comment": {
                const nos = form().getAll("cmt_nos[]");
                for (const comment of this.comments) if (nos.includes(comment.no)) comment.is_delete = "1";
                return json({result: "success", msg: ""});
            }
            case "/ajax/minor_manager_board_ajax/delete_list": {
                // 지운 글은 목록에서 뺀다. 남겨 두면 새로고침이 행을 되살린다.
                const nos = form().getAll("nos[]");
                this.rows = this.rows.filter(({no}) => !nos.includes(String(no)));
                return json({result: "success"});
            }
            case "/dccon/lists":
                // 패키지 줄을 키보드로 옮겨 보도록 패키지를 둘 준다.
                return json({target: "icon", max_page: 0, list: [
                    {package_idx: DCCON.package_idx, title: "테스트콘", main_img_url: DCCON.list_img, detail: [DCCON]},
                    {package_idx: "8", title: "둘째콘", main_img_url: "https://dcimg5.dcinside.com/dccon.php?no=81", detail: [{package_idx: "8", detail_idx: "81", title: "인사", list_img: "https://dcimg5.dcinside.com/dccon.php?no=81"}]}
                ]});
        }
        // 갤로그 글/댓글 수 (유저 버블·글댓비). POST지만 읽기다.
        if (url.pathname.startsWith("/api/gallog_user_layer")) return text("12,34");
        // 그 밖의 쓰기(추천·관리 등)는 나가면 안 된다. 바로 실패로 보이게 500을 준다.
        if (request.method() !== "GET") return route.fulfill({status: 500, body: "unexpected write request"});
        // 이미지 등.
        return route.fulfill({contentType: "image/gif", body: GIF});
    };

    private nextCommentNo(): number {
        return Math.max(0, ...this.comments.map((comment) => Number(comment.no))) + 1;
    }
}

const listRow = ({no, title, nick, uid, ip = "", replies}: FakeRow, manager: boolean): string => `
<tr class="ub-content us-post" data-no="${no}" data-type="icon_txt">
  ${manager ? `<td><input type="checkbox" class="article_chkbox" value="${no}"></td>` : ""}
  <td class="gall_num">${no}</td>
  <td class="gall_tit ub-word"><a href="/board/view/?id=test&no=${no}&page=1"><em class="icon_img icon_txt"></em>${title}</a>${replies ? `<a class="reply_numbox" href="/board/view/?id=test&no=${no}&t=cv"><span class="reply_num">[${replies}]</span></a>` : ""}</td>
  <td class="gall_writer ub-writer" data-nick="${nick}" data-uid="${uid}" data-ip="${ip}"><span class="nickname"><em>${nick}</em></span>${uid ? "<a class=\"writer_nikcon\"><img src=\"https://nstatic.dcinside.com/dc/w/images/fix_nik.gif\"></a>" : `<span class="ip">(${ip})</span>`}</td>
  <td class="gall_date" title="2026-09-30 12:00:00">12:00</td>
  <td class="gall_count">10</td>
  <td class="gall_recommend">0</td>
</tr>`;

const paging = (page: string): string => (page === "1" ? "<em>1</em><a href=\"/board/lists/?id=test&page=2\">2</a>" : "<a href=\"/board/lists/?id=test&page=1\">1</a><em>2</em>");

const listPage = (rows: FakeRow[], page: string, manager: boolean): string => `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>테스트 갤러리</title></head><body>
<div class="page_head"><h2><a href="/board/lists/?id=test">테스트 갤러리</a></h2><div class="gall_issuebox"></div></div>
<input type="hidden" id="e_s_n_o" value="token">
<div class="left_content"><article><div class="gall_listwrap">
<table class="gall_list"><thead><tr>${manager ? "<th class=\"chkbox_th\"></th>" : ""}<th>번호</th><th>제목</th><th>글쓴이</th><th>작성일</th><th>조회</th><th>추천</th></tr></thead>
<tbody>${rows.map((row) => listRow(row, manager)).join("")}</tbody></table>
</div><div class="bottom_paging_box">${paging(page)}</div></article></div>
</body></html>`;

/** 글 페이지에 디시가 그려 둔 댓글. 차단·같은 댓글 접기 같은 페이지 모듈이 본다. */
const pageCommentList = (comments: FakeComment[]): string => (comments.length === 0 ? "" : `
<div class="comment_box"><ul class="cmt_list">${comments.map(({no, name, user_id, ip, memo}) => `
<li id="comment_li_${no}" class="ub-content"><div class="cmt_info clear">
<div class="cmt_nickbox"><span class="gall_writer ub-writer" data-nick="${name}" data-uid="${user_id}" data-ip="${ip}"><span class="nickname"><em>${name}</em></span></span></div>
<div class="clear cmt_txtbox"><p class="usertxt ub-word">${memo}</p></div></div></li>`).join("")}
</ul></div>`);

/**
 * 글 페이지. 미리보기가 받아 읽기도 하고(core/preview/parser.ts) 탭에서 직접 열리기도 한다.
 * 직접 열릴 때 아래 인라인 스크립트가 부르는 디시 전역(_d, $)을 빈 함수로 둔다.
 */
const viewPage = (no: string, comments: FakeComment[]): string => `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>글 ${no}</title>
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
<script id="reply-setting-tmpl" type="text/x-jquery-tmpl"></script><script>_d('${encodeServiceTail(SERVICE_CODE_TAIL)}');</script>
<script>$(document).data('comment_id', 'test'); $(document).data('comment_no', '${no}');</script>
</body></html>`;

// ===== 댓글 폼의 service_code =====

/** 글 페이지 댓글 폼의 service_code. 확장은 끝 10자리를 _d() 값을 푼 글자로 갈아 끼워 보낸다. */
const SERVICE_CODE = "abc0123456789";
/** _d() 값을 풀면 나오는 끝 10자리. 보낸 service_code는 "abc" + 이것이어야 한다. */
export const SERVICE_CODE_TAIL = "e2eRefresh";

/**
 * core/preview/submit.ts가 _d() 값을 푸는 과정의 역.
 * 풀기: 섞은 base64 → 표준 base64 → atob → 첫 자리 숫자 f를 (f > 5 ? f − 5 : f + 4)로 → 쉼표로 나눈 수 v의 i번째는 글자 2(v − i − 1)/(12 − i).
 */
function encodeServiceTail(tail: string): string {
    const shuffled = "yL/M=zNa0bcPQdReSfTgUhViWjXkYIZmnpo+qArOBs1Ct2D3uE4Fv5G6wHl78xJ9K";
    const standard = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    const numbers = Array.from(tail, (char, index) => (char.charCodeAt(0) * (12 - index)) / 2 + index + 1).join(",");
    const first = Number(numbers[0]);
    const encoded = String(first <= 4 ? first + 5 : first - 4) + numbers.slice(1);
    return Array.from(btoa(encoded), (char) => shuffled[standard.indexOf(char)]).join("");
}

/** 1×1 GIF. */
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

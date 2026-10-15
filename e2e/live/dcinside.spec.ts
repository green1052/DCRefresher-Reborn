import {COMMENT_SITE_KEYS, D_ALPHABET, decodeD, ICON_SITE_KEY} from "../../core/preview/dcinside-js";
import {COUNT_CELLS, COUNT_TEXT, LIST_TABLE} from "../../features/refresh/markup";
import {expect, test} from "../fixtures";
import {openListPage} from "../pages/list";

/**
 * 실제 디시에서 읽기만 한다 (bun run e2e:live). 디시 마크업·API가 바뀌면 여기서 걸린다. 쓰기 요청은 픽스처가 끊는다.
 * 글·댓글은 그때그때 다르므로 개수·내용이 아니라 모양만 본다.
 * 기본은 미니 갤러리 bjwg64다. 콘텐츠 스크립트는 모바일 페이지에서 돌지 않아 PC 주소로 연다. DC_LIST_URL로 다른 갤러리의 PC 목록 주소를 줄 수 있다.
 * GitHub의 Live 워크플로(손으로 실행)가 비워 두면 빈 문자열이 오므로 그때도 기본값을 쓴다.
 */
const LIST_URL = process.env.DC_LIST_URL || "https://gall.dcinside.com/mini/board/lists/?id=bjwg64";
const {pathname: LIST_PATH, searchParams} = new URL(LIST_URL);
const GALLERY = searchParams.get("id") ?? "";
/** 공지·설문·광고가 아닌 글 행. */
const POSTS = ".gall_list tbody tr.us-post[data-no]:not([data-type=icon_notice], [data-type=icon_survey])";
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * 기능이 찾는 디시 마크업. 못 찾으면 오류 없이 조용히 멈추는 것들이라 여기서 하나 이상 맞는지 본다.
 * optional은 갤러리·글에 따라 없을 수 있어 없으면 실패 대신 주석만 남긴다.
 * 선택자는 각 기능의 코드(core/list.ts, features/block·search·layout·stealth)에서 옮겼다. 그쪽을 바꾸면 여기도 바꾼다.
 */
interface Markup {
    feature: string;
    selector: string;
    optional?: true;
}

const PAGING = ".left_content article:has(.gall_listwrap) .bottom_paging_box";

const LIST_MARKUP: Markup[] = [
    {feature: "새로고침·검색 이어 보기 (갈아끼울 목록)", selector: ".gall_list:not([id]) tbody > tr.ub-content"},
    {feature: "새로고침·검색 이어 보기 (페이징의 현재 쪽)", selector: `${PAGING} em`},
    {feature: "차단 (작성자 닉네임·아이디·IP)", selector: ".gall_list tr.ub-content > .ub-writer[data-nick][data-uid][data-ip]"},
    {feature: "차단 (제목)", selector: ".gall_list tr.ub-content .gall_tit > a:not([class])"},
    {feature: "차단 (말머리)", selector: ".gall_list tr.ub-content .gall_subject", optional: true},
    {feature: "레이아웃 (갤러리 뷰 숨기기)", selector: ".issue_wrap"},
    {feature: "레이아웃 (갤러리 뷰 숨기기)", selector: "#visit_history"},
    {feature: "레이아웃 (잡다 링크 숨기기)", selector: "section.right_content article"},
    {feature: "레이아웃 (갤러리 공지 숨기기)", selector: "tr:has(em[class*=icon_notice])", optional: true},
    {feature: "레이아웃 (디시 공지 숨기기)", selector: "tr[class*=ub-content]:has(> td[user_name=운영자])", optional: true},
    {feature: "스텔스 (마이너 갤러리 대문)", selector: ".bgcover", optional: true},
    {feature: "스텔스 (오른쪽 영역 썸네일)", selector: ".rcontimg_box .img_box", optional: true}
];

const VIEW_MARKUP: Markup[] = [
    {feature: "차단 (글 보기 머리 작성자)", selector: ".gallview_head.ub-content .ub-writer[data-nick][data-uid][data-ip]"},
    {feature: "차단 (글 보기 제목)", selector: ".gallview_head.ub-content .title_subject"},
    {feature: "차단 (글 보기 말머리)", selector: ".gallview_head.ub-content .title_headtext", optional: true},
    {feature: "스텔스 (본문)", selector: ".writing_view_box .write_div"},
    {feature: "스텔스 (본문 미디어)", selector: ".writing_view_box :is(img, video, embed, iframe)", optional: true},
    {feature: "레이아웃·스텔스 (갤러리 대문)", selector: "#zzbang_div", optional: true}
];

const SEARCH_MARKUP: Markup[] = [
    {feature: "검색 이어 보기 (검색 결과 행)", selector: ".gall_list:not([id]) tbody > tr[data-no]"},
    {feature: "검색 이어 보기 (검색어)", selector: "#sch_q"},
    {feature: "검색 이어 보기 (목록 줄 수)", selector: "#list_num"},
    {feature: "검색 이어 보기 (페이징의 현재 쪽)", selector: `${PAGING} em`},
    // 검색 구간이 하나뿐인 작은 갤러리에는 없다.
    {feature: "검색 이어 보기 (다음 검색)", selector: `${PAGING} a.search_next`, optional: true}
];

test.describe("실제 디시", () => {
    test("글 목록에 배지와 새로고침 버튼을 붙이고, 자동 새로고침이 같은 목록을 다시 받는다", async ({page}) => {
        const list = await openListPage(page, LIST_URL);
        await expect(page.locator(POSTS).first()).toBeVisible();
        await expect(list.refreshButton).toHaveText("자동 새로고침: 켜짐");
        await expect.poll(() => list.badges.count()).toBeGreaterThan(0);

        const refreshed = await page.waitForResponse((response) => response.url().includes(LIST_PATH.replace(/\/$/, "")) && response.request().resourceType() !== "document", {timeout: 30_000});
        expect(refreshed.ok()).toBe(true);
        await expect(page.locator(POSTS).first()).toBeVisible();
    });

    test("제목을 우클릭하면 본문과 댓글 머리를 그리고, 닫으면 목록 주소로 돌아간다", async ({page}) => {
        const list = await openListPage(page, LIST_URL);
        const post = page.locator(POSTS).first();
        const no = await post.getAttribute("data-no");
        await post.locator(".ub-word").click({button: "right"});

        await expect(list.frameTitle).not.toBeEmpty();
        await expect(list.frame.locator(".refresher-preview-contents")).toBeVisible();
        await expect(list.frame.getByText(/^스레드 \d+개, 총 댓글 \d+개|^댓글이 없습니다\.$/).first()).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${escape(LIST_PATH.replace("/lists", "/view"))}\\?id=${GALLERY}&no=${no}`));

        await page.keyboard.press("Escape");
        await expect(list.frame).toHaveCount(0);
        await expect(page).toHaveURL(LIST_URL);
    });

    test("댓글 수를 우클릭하면 댓글 목록 API로 받은 댓글을 그린다", async ({page}) => {
        const list = await openListPage(page, LIST_URL);
        const replies = page.locator(`${POSTS} .reply_numbox`).first();
        test.skip(await replies.count() === 0, "첫 쪽에 댓글 달린 글이 없다");
        const fetched = page.waitForResponse((response) => new URL(response.url()).pathname === "/board/comment/");
        await replies.click({button: "right"});

        await expect(list.frame.getByRole("button", {name: /댓글만 표시 중입니다/})).toBeVisible();
        expect((await fetched).ok()).toBe(true);
        // 댓글이 모두 지워졌을 수도 있어 머리의 개수 줄만 꼭 본다. 그린 댓글이 있으면 작성자가 붙어 있다.
        await expect(list.frame.getByText(/^스레드 \d+개, 총 댓글 \d+개/)).toBeVisible();
        if (await list.comments.count()) await expect(list.comments.first().locator(".refresher-user")).toBeVisible();
    });

    test("회원 작성자를 우클릭하면 버블에 갤로그 글/댓글 수가 보인다", async ({page}) => {
        const list = await openListPage(page, LIST_URL);
        const member = page.locator(`${POSTS} .ub-writer:not([data-uid=""])`).first();
        test.skip(await member.count() === 0, "첫 쪽에 회원 글이 없다");
        const uid = await member.getAttribute("data-uid");
        await member.click({button: "right"});

        await expect(list.bubble).toContainText(uid ?? "");
        await expect(list.bubble).toContainText(/[\d,]+ \/ [\d,]+/);
    });

    test("글 페이지에서도 콘텐츠 스크립트가 돈다", async ({page}) => {
        await openListPage(page, LIST_URL);
        const href = await page.locator(`${POSTS} .ub-word a`).first().getAttribute("href");
        await page.goto(new URL(href ?? "", LIST_URL).href);
        await expect(page.locator(".writing_view_box")).toBeVisible();
        // 글 아래 목록에도 새로고침 버튼을 붙인다.
        await expect(page.locator("button[data-refresher-refresh]")).toHaveCount(1);
        await expect.poll(() => page.locator(".refresher-user-badges").count()).toBeGreaterThan(0);
    });

    // 디시 JS에서 옮겨 쓴 값(core/preview/dcinside-js.ts)이 디시 파일에 그대로 있는지 본다. 바뀌면 댓글·디시콘 작성이 실패한다.
    // 확장 없이 글 페이지와 디시 스크립트만 GET으로 받는다.
    test("디시 JS에서 옮긴 reCAPTCHA 키와 _d() 해독표가 그대로 있다", async ({request}) => {
        const get = async (url: string): Promise<string> => {
            const response = await request.get(url);
            expect(response.ok(), url).toBe(true);
            return response.text();
        };
        const listHtml = await get(LIST_URL);
        const href = /href="([^"]*\/board\/view\/\?[^"]*)"/.exec(listHtml)?.[1];
        expect(href, "목록에 글 주소가 있다").toBeDefined();
        const viewUrl = new URL((href ?? "").replaceAll("&amp;", "&"), LIST_URL).href;
        const view = await get(viewUrl);
        const script = (name: string): Promise<string> => {
            const src = new RegExp(`src="([^"]*/_js/${escape(name)}\\.js[^"]*)"`).exec(view)?.[1];
            expect(src, `${name}.js를 불러온다`).toBeDefined();
            return get(new URL(src ?? "", viewUrl).href);
        };

        // 글 댓글: comment.js의 dc_rc_pairs에서 쌍 이름의 첫 키(v3)다.
        const comment = await script("comment");
        for (const [name, key] of Object.entries(COMMENT_SITE_KEYS)) {
            expect(comment).toMatch(new RegExp(`dc_rc_pairs\\s*=\\s*\\{[^}]*['"]${name}['"]\\s*:\\s*\\[\\s*['"]${escape(key)}['"]`));
        }
        // 디시콘·글자콘: dccon.js·txtcon.js의 키다.
        for (const name of ["dccon/dccon", "dccon/txtcon"]) expect(await script(name)).toContain(ICON_SITE_KEY);

        // _d()는 common.js가 String.fromCharCode로 숨긴 알파벳으로 풀고, service_code 끝 10자리를 바꾸는 식은 _d()로 숨겨 둔다.
        const common = await script("common");
        const charCodes = [...common.matchAll(/String\.fromCharCode\(([\d,]+)\)/g)].map(([, codes = ""]) => String.fromCharCode(...codes.split(",").map(Number)));
        expect(charCodes).toContain(D_ALPHABET);
        expect(common).toContain("fi>5?fi-5:fi+4");
        const hidden = [...common.matchAll(/eval\(_d\('([^']*)'\)\)/g)].map(([, value = ""]) => decodeD(value)).join("\n");
        expect(hidden).toContain("2*(_rs[n]-n-1)/(13-n-1)");
        expect(hidden).toContain(".replace(/(.{10})$/");

        // 글 페이지: 파서(core/preview/parser.ts)가 읽는 자리에 _d('…')와 service_code가 있고, 푼 값은 숫자 목록이다.
        const dValue = /id="reply-setting-tmpl"[\s\S]*?<\/script>\s*<script[^>]*>[^<]*?_d\('([^']*)'\)/.exec(view)?.[1];
        expect(dValue, "reply-setting-tmpl 다음 스크립트에 _d('…')가 있다").toBeDefined();
        expect(decodeD(dValue ?? "")).toMatch(/^\d+(\.\d+)?(,\d+(\.\d+)?)*$/);
        expect(view).toMatch(/name="service_code" value="[^"]{10,}"/);
    });

    // 목록·글·검색 결과를 한 번씩 GET으로 받아(요청 3개) 디시 스크립트를 뺀 채 빈 페이지에 그리고 선택자를 센다.
    // 확장이 고치기 전의 디시 마크업을 봐야 하므로 디시 주소로 열지 않는다. 댓글은 댓글 API로 따로 받아 그리므로 여기서 보지 않는다.
    test("새로고침·차단·검색 이어 보기·레이아웃·스텔스가 찾는 디시 마크업이 그대로 있다", async ({page, request}) => {
        // 그린 HTML의 스타일·이미지·iframe은 받지 않는다. 마크업만 보면 된다.
        await page.route("**/*", (route) => route.abort());
        // 받은 HTML을 돌려준다. 문자열로 찾는 마크업은 그것으로 본다.
        const check = async (url: string, markups: Markup[]): Promise<string> => {
            const response = await request.get(url);
            expect(response.ok(), url).toBe(true);
            const html = await response.text();
            await page.setContent(html.replace(/<script\b[\s\S]*?<\/script>/gi, ""), {waitUntil: "domcontentloaded"});
            for (const {feature, selector, optional} of markups) {
                const count = await page.locator(selector).count();
                if (optional && count === 0) test.info().annotations.push({type: "없음", description: `${feature}: ${selector} (${url})`});
                else expect.soft(count, `${feature}: ${selector}가 없다 (${url})`).toBeGreaterThan(0);
            }
            return html;
        };

        // 새로고침은 받은 목록을 문자열로 다룬다(features/refresh/markup.ts). LIST_TABLE 뒤 첫 tbody를 잘라 비교·부분 파싱하고,
        // 파싱한 행의 outerHTML에 COUNT_TEXT를 써 수 칸 글자를 비워 수만 바뀐 행을 가린다(list.ts frameOf). 자른 tbody가 갈아끼울 목록과 행 수가 같아야 하고,
        // 각 행의 outerHTML을 정규식으로 고쳐 다시 파싱하면 수 칸이 모두 비어 있어야 한다. 수를 자식 요소로 감싸면 정규식이 잡아도 비우지 못한다.
        const listHtml = await check(LIST_URL, LIST_MARKUP);
        const table = listHtml.indexOf(LIST_TABLE);
        expect(table, `새로고침 (목록 표): ${LIST_TABLE}가 없다`).toBeGreaterThan(-1);
        const start = listHtml.indexOf("<tbody", table);
        const tbody = listHtml.slice(start, listHtml.indexOf("</tbody>", start));
        const rows = page.locator(".gall_list:not([id]) tbody > tr");
        expect.soft(tbody.match(/<tr\b/g)?.length ?? 0, "새로고침 (목록 tbody): 문자열로 자른 tbody가 목록과 다르다").toBe(await rows.count());
        const cleared = await rows.evaluateAll((trs, [source, flags, cells]) => trs.every((tr) => {
            const template = document.createElement("template");
            template.innerHTML = tr.outerHTML.replace(new RegExp(source, flags), "$1");
            return [...template.content.querySelectorAll(cells)].every((cell) => cell.textContent === "");
        }), [COUNT_TEXT.source, COUNT_TEXT.flags, COUNT_CELLS] as const);
        expect.soft(cleared, `새로고침 (수 칸): ${COUNT_TEXT}가 행의 수 칸 글자를 다 비우지 못한다`).toBe(true);

        const post = page.locator(`${POSTS} .gall_tit > a:not([class])`).first();
        const href = await post.getAttribute("href");
        // 첫 글 제목으로 검색하면 어느 갤러리에서든 결과가 하나는 나온다.
        const title = (await post.textContent())?.trim() ?? "";
        expect(href, "목록에 글 주소가 있다").toBeTruthy();

        await check(new URL(href ?? "", LIST_URL).href, VIEW_MARKUP);

        const search = new URL(LIST_URL);
        search.searchParams.set("s_type", "search_subject");
        search.searchParams.set("s_keyword", title);
        await check(search.href, SEARCH_MARKUP);
    });
});

import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

import {type BrowserContext, chromium, firefox, type Page, test as base} from "@playwright/test";
import type {browser} from "wxt/browser";

import {COMMENTS, commentsResponse, type FakeComment, type FakeRow, fakeComment, GIF, listPage, ROWS, viewPage} from "./dcinside";
import {type FirefoxAddon, firefoxUserPrefs, freePort, installTemporaryAddon} from "./firefox";
import {type ListPage, openListPage} from "./pages/list";

/** 확장 페이지·서비스 워커 안(evaluate)의 chrome 전역. 테스트 파일은 확장 번들이 아니라 타입이 없다. */
declare const chrome: typeof browser;

const pathToExtension = path.resolve(".output/chrome-mv3");
const pathToFirefoxExtension = path.resolve(".output/firefox-mv2");
/** IP·밴 DB 서버. 가짜 디시로 돌릴 때는 끊는다. */
const IP_DB_HOST = "dcrefresher.green1052.com";

/** 확장 저장소. 디시 페이지(page.evaluate)에서는 chrome.storage에 닿지 않으므로 배경(서비스 워커)에서 읽고 쓴다. */
interface ExtensionStorage {
    set(items: Record<string, unknown>): Promise<void>;
    get(key: string): Promise<unknown>;
    /** 모듈 on/off (refresher:modules). */
    setModules(enables: Record<string, boolean>): Promise<void>;
    /** 모듈 하나의 설정 (refresher:module:<id>:settings). 없는 키는 기본값이다. */
    setModuleSettings(id: string, settings: Record<string, unknown>): Promise<void>;
}

/**
 * 가짜 디시의 상태. 테스트가 바꾸면 다음 요청부터 그대로 응답한다 (자동 새로고침·댓글 새로고침이 받는 목록).
 * 댓글 작성(comment_submit)은 디시처럼 새 댓글 번호를 주고 comments에 넣고, 댓글 삭제는 그 댓글을 지운 것으로 바꾼다. 보낸 폼은 submitted에 남는다.
 */
interface FakeSite {
    rows: FakeRow[];
    comments: FakeComment[];
    /** 글 페이지를 직접 열었을 때 디시가 그려 둔 댓글. 기본은 없다. */
    pageComments: FakeComment[];
    submitted: { path: string; body: URLSearchParams }[];
}

/** 댓글 작성(comment_submit)에 디시처럼 새 댓글 번호를 돌려주고 댓글 목록에 넣는다. */
const acceptComment = (site: FakeSite, body: URLSearchParams): string => {
    const no = Math.max(0, ...site.comments.map((comment) => Number(comment.no))) + 1;
    const parent = body.get("c_no");
    site.comments.push(fakeComment(no, {c_no: parent ?? String(no), depth: parent ? 1 : 0, name: body.get("name") ?? "", memo: body.get("memo") ?? ""}));
    return String(no);
};

/** 파이어폭스 컨텍스트에 설치한 부가 기능. 저장소는 이 연결로 배경 페이지에서 다룬다. */
const firefoxAddons = new WeakMap<BrowserContext, FirefoxAddon>();

/** 크로미엄의 배경 서비스 워커 (WXT 예제와 같다). */
const serviceWorker = async (context: BrowserContext) => context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");

/** 디시에 보내도 되는 POST. 모두 읽기다 (댓글 목록, 갤로그 글/댓글 수, 디시콘 목록·정보). */
const LIVE_READ_POSTS = /^\/(board\/comment\/$|api\/gallog_user_layer\/|dccon\/(lists|package_detail)$)/;

/**
 * 실제 디시로 보내되 쓰기는 막는다. 디시·IP DB 서버 밖(광고·추적)은 끊어 느려지거나 흔들리지 않게 한다.
 * 디시 스크립트가 보내는 POST(조회수·로그 등)도 읽기 목록에 없으면 끊는다.
 */
const routeLive = async (context: BrowserContext): Promise<void> => {
    await context.route(/^https?:\/\//, (route) => {
        const url = new URL(route.request().url());
        const dcinside = /(^|\.)dcinside\.(com|co\.kr)$/.test(url.hostname);
        if (!dcinside && url.hostname !== IP_DB_HOST) return route.abort();
        if (route.request().method() !== "GET" && !(dcinside && LIVE_READ_POSTS.test(url.pathname))) return route.abort();
        return route.continue();
    });
};

/**
 * 빌드한 확장을 올린 브라우저 컨텍스트 (WXT의 Playwright 예제 wxt-dev/examples의 playwright-e2e-testing과 같은 방식).
 * - 확장은 영속 컨텍스트에서만 올라간다. headless도 크로미엄 본체(channel: chromium)여야 확장이 돈다 (headless shell은 확장을 못 올린다).
 *   PLAYWRIGHT_CHROMIUM에 실행 파일을 주면 그것을 쓴다 (playwright install 없이 미리 설치된 크로미엄으로 돌릴 때).
 * - 파이어폭스(firefox 프로젝트)는 .output/firefox-mv2를 원격 디버깅 서버로 임시 설치하고, 저장소는 그 연결로 배경 페이지에서 읽고 쓴다 (e2e/firefox.ts).
 *   플레이라이트의 파이어폭스는 확장 페이지를 열지 못해 팝업·옵션 테스트는 크로미엄에서만 돈다 (playwright.config.ts).
 * - dcinside.com 주소는 모두 e2e/dcinside.ts의 가짜 페이지로 응답하고 IP DB 서버(dcrefresher.green1052.com)는 끊는다.
 *   live 프로젝트(e2e/live)만 실제 디시에 읽기 요청을 보낸다 (routeLive).
 * - errors: 페이지 오류와 console.error를 모은다. 테스트 끝에 비어 있어야 한다.
 */
export const test = base.extend<{ live: boolean }>({
    /** 실제 디시에 요청하는지. live 프로젝트가 켠다 (playwright.config.ts). */
    live: [false, {option: true}]
}).extend<{ site: FakeSite; context: BrowserContext; extensionId: string; errors: string[]; storage: ExtensionStorage; listPage: ListPage }>({
    // 테스트마다 기본 목록·댓글에서 시작한다. 배열은 복사해 테스트가 바꿔도 다른 테스트에 남지 않는다.
    site: async ({}, use) => {
        await use({rows: [...ROWS], comments: COMMENTS.map((comment) => ({...comment})), pageComments: [], submitted: []});
    },

    context: async ({browserName, live, site}, use) => {
        const profile = mkdtempSync(path.join(tmpdir(), "refresher-e2e-"));
        let context: BrowserContext;
        if (browserName === "firefox") {
            const port = await freePort();
            context = await firefox.launchPersistentContext(profile, {
                headless: true,
                args: ["-start-debugger-server", String(port)],
                firefoxUserPrefs: firefoxUserPrefs(!live)
            });
            try {
                firefoxAddons.set(context, await installTemporaryAddon(port, pathToFirefoxExtension));
            } catch (error) {
                await context.close();
                rmSync(profile, {recursive: true, force: true});
                throw error;
            }
        } else {
            context = await chromium.launchPersistentContext(profile, {
                headless: true,
                ...(process.env.PLAYWRIGHT_CHROMIUM ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM} : {channel: "chromium"}),
                args: [`--disable-extensions-except=${pathToExtension}`, `--load-extension=${pathToExtension}`]
            });
        }

        if (live) await routeLive(context);
        else await context.route(/^https:\/\/([a-z0-9]+\.)?dcinside\.com\//, (route) => {
            const url = new URL(route.request().url());
            if (url.pathname.startsWith("/board/lists")) return route.fulfill({contentType: "text/html; charset=utf-8", body: listPage(site.rows)});
            // 임시 차단된 페이지(본문이 빈 페이지). 글 목록·본문이 아니라 미리보기 모듈이 등록되지 않는다.
            if (url.pathname.startsWith("/board/write")) return route.fulfill({contentType: "text/html; charset=utf-8", body: "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body></body></html>"});
            if (url.pathname.startsWith("/board/view")) return route.fulfill({contentType: "text/html; charset=utf-8", body: viewPage(url.searchParams.get("no") ?? "", site.pageComments)});
            if (url.pathname === "/board/comment/") return route.fulfill({contentType: "application/json", body: commentsResponse(site.comments)});
            if (url.pathname === "/board/forms/comment_submit") {
                const body = new URLSearchParams(route.request().postData() ?? "");
                site.submitted.push({path: url.pathname, body});
                return route.fulfill({contentType: "text/plain", body: acceptComment(site, body)});
            }
            if (url.pathname === "/board/comment/comment_delete_submit") {
                const body = new URLSearchParams(route.request().postData() ?? "");
                site.submitted.push({path: url.pathname, body});
                const target = site.comments.find((comment) => comment.no === body.get("re_no"));
                if (target) target.is_delete = "1";
                return route.fulfill({contentType: "text/plain", body: target ? "true" : "false||댓글이 없습니다."});
            }
            // 갤로그 글/댓글 수 (유저 버블·글댓비). POST지만 읽기다.
            if (url.pathname.startsWith("/api/gallog_user_layer")) return route.fulfill({contentType: "text/plain", body: "12,34"});
            // 쓰기 요청(댓글·추천·관리)은 테스트에서 절대 나가면 안 된다. 나가면 바로 실패로 보이게 500을 준다.
            if (route.request().method() === "POST") return route.fulfill({status: 500, body: "unexpected write request"});
            return route.fulfill({contentType: "image/gif", body: GIF});
        });
        if (!live) await context.route((url) => url.hostname === IP_DB_HOST, (route) => route.abort());

        await use(context);
        firefoxAddons.get(context)?.close();
        await context.close();
        // 테스트마다 새 프로필을 만들므로 지운다. 두면 임시 폴더에 브라우저 프로필이 쌓인다.
        rmSync(profile, {recursive: true, force: true});
    },

    extensionId: async ({browserName, context}, use) => {
        if (browserName === "firefox") throw new Error("플레이라이트의 파이어폭스는 확장 페이지를 열지 못한다. 확장 페이지 테스트는 크로미엄에서만 돈다.");
        await use((await serviceWorker(context)).url().split("/")[2]!);
    },

    storage: async ({browserName, context}, use) => {
        const addon = firefoxAddons.get(context);
        const worker = browserName === "firefox" ? undefined : await serviceWorker(context);
        const set = async (items: Record<string, unknown>): Promise<void> => {
            if (addon) await addon.evaluate(`browser.storage.local.set(${JSON.stringify(items)})`);
            else await worker!.evaluate((items) => chrome.storage.local.set(items), items);
        };
        await use({
            set,
            get: async (key) => (addon
                ? addon.evaluate(`browser.storage.local.get(${JSON.stringify(key)}).then((items) => items[${JSON.stringify(key)}])`)
                : (await worker!.evaluate((key) => chrome.storage.local.get(key), key))[key]),
            setModules: (enables) => set({"refresher:modules": enables}),
            setModuleSettings: (id, settings) => set({[`refresher:module:${id}:settings`]: settings})
        });
    },

    errors: async ({context, live}, use) => {
        const errors: string[] = [];
        // 실제 디시 페이지는 디시 스크립트·끊은 광고에서 오류가 난다. 확장 코드(chrome-extension://)에서 난 것만 본다.
        const fromExtension = (where: string | undefined): boolean => !live || /(chrome|moz)-extension:\/\//.test(where ?? "");
        context.on("weberror", (error) => {
            if (fromExtension(error.error().stack)) errors.push(`pageerror ${error.page()?.url()}: ${error.error().message}`);
        });
        const watch = (page: Page) => page.on("console", (message) => {
            if (message.type() === "error" && fromExtension(message.location().url)) errors.push(`console ${page.url()}: ${message.text()}`);
        });
        // 이미 열린 페이지(page 픽스처 등)도 본다.
        context.pages().forEach(watch);
        context.on("page", watch);
        await use(errors);
        expect(errors, "페이지 오류·console.error가 없어야 한다").toEqual([]);
    },

    /** 콘텐츠 스크립트가 돈 가짜 글 목록 페이지 (pages/list.ts). */
    listPage: async ({errors: _errors, page}, use) => {
        await use(await openListPage(page));
    }
});

/** 확장 페이지(옵션·팝업)에서 저장소 값을 읽는다. */
export const storedIn = (page: Page, key: string): Promise<unknown> => page.evaluate(async (key) => (await chrome.storage.local.get(key))?.[key], key);

export const expect = test.expect;

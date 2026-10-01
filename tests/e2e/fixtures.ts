import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

import {type BrowserContext, chromium, type Page, test as base} from "@playwright/test";
import type {browser} from "wxt/browser";

import {commentsResponse, GIF, listPage, viewPage} from "./dcinside";

/** 확장 페이지·서비스 워커 안(evaluate)의 chrome 전역. 테스트 파일은 확장 번들이 아니라 타입이 없다 */
declare const chrome: typeof browser;

const extension = path.resolve(".output/chrome-mv3");

/**
 * 빌드한 확장을 올린 브라우저 컨텍스트 (WXT의 Playwright 예제와 같은 방식).
 * - 확장은 영속 컨텍스트에서만 올라간다. headless도 크로미엄 본체(channel: chromium)여야 확장이 돈다 (headless shell은 확장을 못 올린다).
 *   PLAYWRIGHT_CHROMIUM에 실행 파일을 주면 그것을 쓴다 (playwright install 없이 미리 설치된 크로미엄으로 돌릴 때).
 * - dcinside.com 주소는 모두 tests/e2e/dcinside.ts의 가짜 페이지로 응답한다. 디시에 요청을 보내지 않는다.
 * - IP DB 서버(dcrefresher.green1052.com)는 끊는다.
 * - errors: 페이지 오류와 console.error를 모은다. 테스트 끝에 비어 있어야 한다
 */
/** 확장 저장소. 디시 페이지(page.evaluate)에서는 chrome.storage에 닿지 않으므로 서비스 워커에서 읽고 쓴다 */
export interface ExtensionStorage {
    set(items: Record<string, unknown>): Promise<void>;
    get(key: string): Promise<unknown>;
}

export const test = base.extend<{ context: BrowserContext; extensionId: string; errors: string[]; storage: ExtensionStorage; listPage: Page }>({
    context: async ({}, use) => {
        const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), "refresher-e2e-")), {
            headless: true,
            ...(process.env.PLAYWRIGHT_CHROMIUM ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM} : {channel: "chromium"}),
            args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
        });

        await context.route(/^https:\/\/([a-z0-9]+\.)?dcinside\.com\//, (route) => {
            const url = new URL(route.request().url());
            if (url.pathname.startsWith("/board/lists")) return route.fulfill({contentType: "text/html; charset=utf-8", body: listPage()});
            if (url.pathname.startsWith("/board/view")) return route.fulfill({contentType: "text/html; charset=utf-8", body: viewPage(url.searchParams.get("no") ?? "")});
            if (url.pathname.startsWith("/board/comment")) return route.fulfill({contentType: "application/json", body: commentsResponse()});
            // 갤로그 글/댓글 수 (유저 버블·글댓비). POST지만 읽기다
            if (url.pathname.startsWith("/api/gallog_user_layer")) return route.fulfill({contentType: "text/plain", body: "12,34"});
            // 쓰기 요청(댓글·추천·관리)은 테스트에서 절대 나가면 안 된다. 나가면 바로 실패로 보이게 500을 준다
            if (route.request().method() === "POST") return route.fulfill({status: 500, body: "unexpected write request"});
            return route.fulfill({contentType: "image/gif", body: GIF});
        });
        await context.route(/^https:\/\/dcrefresher\.green1052\.com\//, (route) => route.abort());

        await use(context);
        await context.close();
    },

    extensionId: async ({context}, use) => {
        let [worker] = context.serviceWorkers();
        if (!worker) worker = await context.waitForEvent("serviceworker");
        await use(new URL(worker.url()).host);
    },

    storage: async ({context, extensionId: _extensionId}, use) => {
        // extensionId를 기다렸으므로 워커가 있다
        const worker = context.serviceWorkers()[0]!;
        await use({
            set: (items) => worker.evaluate((items) => chrome.storage.local.set(items), items),
            get: async (key) => (await worker.evaluate((key) => chrome.storage.local.get(key), key))?.[key]
        });
    },

    errors: async ({context}, use) => {
        const errors: string[] = [];
        context.on("weberror", (error) => errors.push(`pageerror ${error.page()?.url()}: ${error.error().message}`));
        context.on("page", (page) => page.on("console", (message) => {
            if (message.type() === "error") errors.push(`console ${page.url()}: ${message.text()}`);
        }));
        await use(errors);
        expect(errors, "페이지 오류·console.error가 없어야 한다").toEqual([]);
    },

    /** 콘텐츠 스크립트가 돈 가짜 글 목록 페이지. 새로고침 버튼이 붙을 때까지 기다린다 */
    listPage: async ({context, errors: _errors}, use) => {
        const page = await context.newPage();
        await page.goto("https://gall.dcinside.com/board/lists/?id=test");
        await page.waitForSelector("button[data-refresher-refresh]");
        await use(page);
    }
});

/** 확장 페이지(옵션·팝업)에서 저장소 값을 읽는다 */
export const storedIn = (page: Page, key: string): Promise<unknown> => page.evaluate(async (key) => (await chrome.storage.local.get(key))?.[key], key);

export const expect = test.expect;

/** 오버레이 shadow root. 오버레이는 처음 필요할 때 붙으므로 기다린다 */
export const overlay = (page: Page) => page.locator("refresher-root");

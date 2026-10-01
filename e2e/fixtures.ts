import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

import {type BrowserContext, chromium, firefox, type Page, test as base, type Worker} from "@playwright/test";
import type {browser} from "wxt/browser";

import {commentsResponse, GIF, listPage, viewPage} from "./dcinside";
import {FIREFOX_EXTENSION_UUID, firefoxUserPrefs, freePort, installTemporaryAddon} from "./firefox";
import {extensionUrl} from "./pages/extension";
import {type ListPage, openListPage} from "./pages/list";

/** 확장 페이지·서비스 워커 안(evaluate)의 chrome 전역. 테스트 파일은 확장 번들이 아니라 타입이 없다. */
declare const chrome: typeof browser;

const pathToExtension = path.resolve(".output/chrome-mv3");
const pathToFirefoxExtension = path.resolve(".output/firefox-mv2");

/**
 * 빌드한 확장을 올린 브라우저 컨텍스트 (WXT의 Playwright 예제 wxt-dev/examples의 playwright-e2e-testing과 같은 방식).
 * - 확장은 영속 컨텍스트에서만 올라간다. headless도 크로미엄 본체(channel: chromium)여야 확장이 돈다 (headless shell은 확장을 못 올린다).
 *   PLAYWRIGHT_CHROMIUM에 실행 파일을 주면 그것을 쓴다 (playwright install 없이 미리 설치된 크로미엄으로 돌릴 때).
 * - 파이어폭스(firefox 프로젝트)는 .output/firefox-mv2를 원격 디버깅 서버로 임시 설치한다 (e2e/firefox.ts).
 *   배경 페이지에 닿을 수 없어 저장소는 확장 페이지(popup.html)를 하나 열어 그 안에서 읽고 쓴다.
 * - dcinside.com 주소는 모두 e2e/dcinside.ts의 가짜 페이지로 응답한다. 디시에 요청을 보내지 않는다.
 * - IP DB 서버(dcrefresher.green1052.com)는 끊는다.
 * - errors: 페이지 오류와 console.error를 모은다. 테스트 끝에 비어 있어야 한다.
 */
/** 확장 저장소. 디시 페이지(page.evaluate)에서는 chrome.storage에 닿지 않으므로 배경(서비스 워커)에서 읽고 쓴다. */
export interface ExtensionStorage {
    set(items: Record<string, unknown>): Promise<void>;
    get(key: string): Promise<unknown>;
    /** 모듈 on/off (refresher:modules). */
    setModules(enables: Record<string, boolean>): Promise<void>;
    /** 모듈 하나의 설정 (refresher:module:<id>:settings). 없는 키는 기본값이다. */
    setModuleSettings(id: string, settings: Record<string, unknown>): Promise<void>;
}

/** 배경 스크립트. MV3는 서비스 워커, MV2는 배경 페이지다. */
type Background = Worker | Page;

/** 크로미엄의 배경 스크립트 (WXT 예제와 같다). */
const chromiumBackground = async (context: BrowserContext): Promise<Background> => {
    let background: Background | undefined;
    if (pathToExtension.endsWith("-mv3")) {
        [background] = context.serviceWorkers();
        background ??= await context.waitForEvent("serviceworker");
    } else {
        [background] = context.backgroundPages();
        background ??= await context.waitForEvent("backgroundpage");
    }
    return background;
};

export const test = base.extend<{ context: BrowserContext; background: Background; extensionId: string; errors: string[]; storage: ExtensionStorage; listPage: ListPage }>({
    context: async ({browserName}, use) => {
        const profile = mkdtempSync(path.join(tmpdir(), "refresher-e2e-"));
        let context: BrowserContext;
        if (browserName === "firefox") {
            const port = await freePort();
            context = await firefox.launchPersistentContext(profile, {
                headless: true,
                args: ["-start-debugger-server", String(port)],
                firefoxUserPrefs: firefoxUserPrefs()
            });
            await installTemporaryAddon(port, pathToFirefoxExtension);
        } else {
            context = await chromium.launchPersistentContext(profile, {
                headless: true,
                ...(process.env.PLAYWRIGHT_CHROMIUM ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM} : {channel: "chromium"}),
                args: [`--disable-extensions-except=${pathToExtension}`, `--load-extension=${pathToExtension}`]
            });
        }

        await context.route(/^https:\/\/([a-z0-9]+\.)?dcinside\.com\//, (route) => {
            const url = new URL(route.request().url());
            if (url.pathname.startsWith("/board/lists")) return route.fulfill({contentType: "text/html; charset=utf-8", body: listPage()});
            if (url.pathname.startsWith("/board/view")) return route.fulfill({contentType: "text/html; charset=utf-8", body: viewPage(url.searchParams.get("no") ?? "")});
            if (url.pathname.startsWith("/board/comment")) return route.fulfill({contentType: "application/json", body: commentsResponse()});
            // 갤로그 글/댓글 수 (유저 버블·글댓비). POST지만 읽기다.
            if (url.pathname.startsWith("/api/gallog_user_layer")) return route.fulfill({contentType: "text/plain", body: "12,34"});
            // 쓰기 요청(댓글·추천·관리)은 테스트에서 절대 나가면 안 된다. 나가면 바로 실패로 보이게 500을 준다.
            if (route.request().method() === "POST") return route.fulfill({status: 500, body: "unexpected write request"});
            return route.fulfill({contentType: "image/gif", body: GIF});
        });
        await context.route(/^https:\/\/dcrefresher\.green1052\.com\//, (route) => route.abort());

        await use(context);
        await context.close();
        // 테스트마다 새 프로필을 만들므로 지운다. 두면 임시 폴더에 브라우저 프로필이 쌓인다.
        rmSync(profile, {recursive: true, force: true});
    },

    background: async ({context, browserName}, use) => {
        if (browserName === "firefox") {
            // 배경 페이지 대신 확장 페이지 하나를 연다. 같은 확장 출처라 browser.storage에 닿는다.
            const page = await context.newPage();
            await page.goto(extensionUrl(FIREFOX_EXTENSION_UUID, "popup.html"));
            await use(page);
            return;
        }
        await use(await chromiumBackground(context));
    },

    extensionId: async ({browserName, context}, use) => {
        // 파이어폭스는 UUID를 고정해 두었다. 배경 대신 여는 페이지가 팝업 테스트의 활성 탭을 바꾸지 않게 background를 쓰지 않는다.
        if (browserName === "firefox") await use(FIREFOX_EXTENSION_UUID);
        else await use((await chromiumBackground(context)).url().split("/")[2]!);
    },

    storage: async ({background}, use) => {
        // Worker와 Page의 evaluate는 시그니처가 달라 합친 타입으로는 부를 수 없어 나눠 부른다.
        const setItems = (items: Record<string, unknown>) => chrome.storage.local.set(items);
        const getItem = (key: string) => chrome.storage.local.get(key);
        const set = (items: Record<string, unknown>) => ("goto" in background ? background.evaluate(setItems, items) : background.evaluate(setItems, items));
        await use({
            set,
            get: async (key) => ("goto" in background ? await background.evaluate(getItem, key) : await background.evaluate(getItem, key))?.[key],
            setModules: (enables) => set({"refresher:modules": enables}),
            setModuleSettings: (id, settings) => set({[`refresher:module:${id}:settings`]: settings})
        });
    },

    errors: async ({context}, use) => {
        const errors: string[] = [];
        context.on("weberror", (error) => errors.push(`pageerror ${error.page()?.url()}: ${error.error().message}`));
        const watch = (page: Page) => page.on("console", (message) => {
            if (message.type() === "error") errors.push(`console ${page.url()}: ${message.text()}`);
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

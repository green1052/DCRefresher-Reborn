import {fileURLToPath} from "node:url";

import {type BrowserContext, chromium, firefox, test as base, type Worker} from "@playwright/test";
import type {browser} from "wxt/browser";

import {FakeSite} from "./dcinside";
import {DEBUGGER_PREFS, type FirefoxAddon, freePort, installTemporaryAddon, OFFLINE_PREFS} from "./firefox";
import {type ListPage, openListPage} from "./pages/list";

/** 서비스 워커 안(evaluate)의 chrome 전역. 테스트 파일은 확장 번들이 아니라 타입이 없다. */
declare const chrome: typeof browser;

const CHROME_EXTENSION = fileURLToPath(new URL("../.output/chrome-mv3", import.meta.url));
const FIREFOX_EXTENSION = fileURLToPath(new URL("../.output/firefox-mv2", import.meta.url));
/** IP·밴 DB 서버. */
const IP_DB_HOST = "dcrefresher.green1052.com";
const DCINSIDE = /^https:\/\/([a-z0-9-]+\.)*dcinside\.(com|co\.kr)$/;

/** 저장소 값 (JSON). */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** 확장 저장소(browser.storage.local). 디시 페이지의 evaluate로는 닿지 않아 배경에서 읽고 쓴다. */
export interface ExtensionStorage {
    get(key: string): Promise<unknown>;

    set(items: Record<string, Json>): Promise<void>;

    /** 모듈 켜고 끄기 (refresher:modules). 적지 않은 모듈은 기본값이다. */
    setModules(enables: Record<string, boolean>): Promise<void>;

    /** 모듈 하나의 설정 (refresher:module:<id>:settings). 적지 않은 설정은 기본값이다. */
    setModuleSettings(id: string, settings: Record<string, Json>): Promise<void>;
}

/** 디시에 보내도 되는 POST. 모두 읽기다 (댓글 목록, 갤로그 글/댓글 수, 디시콘 목록·정보). */
const LIVE_READ_POSTS = /^\/(board\/comment\/$|api\/gallog_user_layer\/|dccon\/(lists|package_detail)$)/;

/** 실제 디시(live)로 보내되, 쓰기와 디시·IP DB 밖(광고·추적)은 끊는다. 디시 스크립트의 POST(조회수·로그)도 끊는다. */
const routeLive = async (context: BrowserContext): Promise<void> => {
    await context.route(/^https?:\/\//, (route) => {
        const request = route.request();
        const {hostname, pathname} = new URL(request.url());
        const dcinside = DCINSIDE.test(`https://${hostname}`);
        if (!dcinside && hostname !== IP_DB_HOST) return route.abort();
        if (request.method() !== "GET" && !(dcinside && LIVE_READ_POSTS.test(pathname))) return route.abort();
        return route.continue();
    });
};

/** 확장의 배경. 크로미엄은 서비스 워커, 파이어폭스는 디버깅 연결로 붙은 배경 페이지다. */
type Background = { kind: "chromium"; worker: Worker } | { kind: "firefox"; addon: FirefoxAddon };
const backgrounds = new WeakMap<BrowserContext, Background>();

/**
 * 확장을 올린 브라우저 컨텍스트를 테스트마다 새 프로필로 띄운다.
 * - 크로미엄: 확장은 영속 컨텍스트에서만 올라가고, headless shell이 아니라 크로미엄 본체(channel: chromium)여야 한다.
 *   PLAYWRIGHT_CHROMIUM에 실행 파일을 주면 그것을 쓴다.
 * - 파이어폭스: 원격 디버깅 서버로 임시 부가 기능을 설치한다 (firefox.ts). 확장 페이지로는 이동하지 못해 팝업·옵션 테스트는 크로미엄에서만 돈다.
 * - dcinside.com 요청은 가짜 디시(site)가 응답하고 IP DB 서버는 끊는다. live 프로젝트만 실제 디시에 읽기 요청을 보낸다.
 */
export const test = base.extend<{ live: boolean }>({
    live: [false, {option: true}]
}).extend<{ site: FakeSite; context: BrowserContext; extensionId: string; storage: ExtensionStorage; errors: string[]; listPage: ListPage }>({
    site: async ({}, use) => {
        await use(new FakeSite());
    },

    context: async ({browserName, live, site}, use) => {
        // 프로필 경로를 비워 두면 플레이라이트가 테스트마다 임시 프로필을 만들고 닫을 때 지운다.
        let context: BrowserContext | undefined;
        try {
            if (browserName === "firefox") {
                // 플레이라이트의 파이어폭스는 수십 번에 한 번꼴로 뜨다가 멈춘다 (디버깅 서버 없이도 그렇다). 짧게 기다리고 새 프로필로 다시 띄운다.
                for (let attempt = 1; !context; attempt++) {
                    const port = await freePort();
                    try {
                        context = await firefox.launchPersistentContext("", {
                            headless: true,
                            timeout: 15_000,
                            args: ["-start-debugger-server", String(port)],
                            firefoxUserPrefs: {...DEBUGGER_PREFS, ...(!live && OFFLINE_PREFS)}
                        });
                    } catch (e) {
                        if (attempt === 3) throw e;
                        continue;
                    }
                    backgrounds.set(context, {kind: "firefox", addon: await installTemporaryAddon(port, FIREFOX_EXTENSION)});
                }
            } else {
                context = await chromium.launchPersistentContext("", {
                    headless: true,
                    // 실제 브라우저처럼 자리를 차지하는 스크롤바를 그린다. 스크롤을 잠가도 페이지가 옆으로 밀리지 않는지 확인한다.
                    ignoreDefaultArgs: ["--hide-scrollbars"],
                    ...(process.env.PLAYWRIGHT_CHROMIUM ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM} : {channel: "chromium"}),
                    args: [`--disable-extensions-except=${CHROME_EXTENSION}`, `--load-extension=${CHROME_EXTENSION}`]
                });
                const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
                backgrounds.set(context, {kind: "chromium", worker});
            }

            if (live) {
                await routeLive(context);
            } else {
                await context.route((url) => DCINSIDE.test(url.origin), site.handle);
                await context.route((url) => url.hostname === IP_DB_HOST, (route) => route.abort());
            }

            await use(context);
        } finally {
            const background = context && backgrounds.get(context);
            if (background?.kind === "firefox") background.addon.close();
            await context?.close();
        }
    },

    extensionId: async ({context}, use) => {
        const background = backgrounds.get(context);
        if (background?.kind !== "chromium") throw new Error("확장 페이지 테스트는 크로미엄에서만 돈다 (플레이라이트의 파이어폭스는 moz-extension:// 페이지로 이동하지 못한다).");
        await use(new URL(background.worker.url()).host);
    },

    storage: async ({context}, use) => {
        const background = backgrounds.get(context)!;
        const get = async (key: string): Promise<unknown> => {
            if (background.kind === "firefox") return background.addon.evaluate<unknown>(`browser.storage.local.get(${JSON.stringify(key)}).then((items) => items[${JSON.stringify(key)}])`);
            const items = await background.worker.evaluate((key) => chrome.storage.local.get(key), key);
            return items[key];
        };
        const set = async (items: Record<string, Json>): Promise<void> => {
            if (background.kind === "firefox") {
                await background.addon.evaluate(`browser.storage.local.set(${JSON.stringify(items)})`);
                return;
            }
            // Json 그대로 넘기면 evaluate 인자의 타입 계산이 끝없이 깊어진다.
            const values: Record<string, unknown> = items;
            await background.worker.evaluate((values) => chrome.storage.local.set(values), values);
        };
        await use({
            get,
            set,
            setModules: (enables) => set({"refresher:modules": enables}),
            setModuleSettings: (id, settings) => set({[`refresher:module:${id}:settings`]: settings})
        });
    },

    // 모든 테스트에 건다. 페이지 오류·console.error가 하나라도 나면 실패한다.
    errors: [async ({context, live}, use) => {
        const errors: string[] = [];
        // 실제 디시는 디시 스크립트·끊은 광고에서 오류가 난다. 확장 코드에서 난 것만 본다.
        const ours = (where: string | undefined): boolean => !live || /(chrome|moz)-extension:\/\//.test(where ?? "");
        context.on("weberror", (error) => {
            if (ours(error.error().stack)) errors.push(`pageerror ${error.page()?.url()}: ${error.error().message}`);
        });
        // 페이지의 것만 본다. 서비스 워커는 끊어 둔 IP DB를 받지 못해 console.error를 남긴다.
        context.on("console", (message) => {
            const page = message.page();
            if (page && message.type() === "error" && ours(message.location().url)) errors.push(`console ${page.url()}: ${message.text()}`);
        });
        await use(errors);
        test.expect(errors, "페이지 오류·console.error가 없어야 한다").toEqual([]);
    }, {auto: true}],

    listPage: async ({page}, use) => {
        await use(await openListPage(page));
    }
});

export const expect = test.expect;

import type {Page} from "@playwright/test";

import {extensionUrl} from "./extension";

export type OptionsTab = "general" | "block" | "data";

/** 옵션 페이지. 탭은 주소의 해시로 고른다. */
export async function openOptions(page: Page, extensionId: string, tab: OptionsTab) {
    const goto = (next: OptionsTab) => page.goto(extensionUrl(extensionId, `options.html#${next}`));
    await goto(tab);

    const options = {
        page,
        goto,
        cards: () => page.locator(".rt-Card"),
        /** 모듈 카드 (제목으로 찾는다). */
        card: (name: string) => options.cards().filter({hasText: name})
    };
    return options;
}

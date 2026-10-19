// @vitest-environment node
import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {settingsOf} from "@/core/module/settings";
import background from "@/features/imagesearch/background";

/** fake-browser에 없는 contextMenus를 메뉴 id 집합으로 흉내 낸다. 브라우저처럼 같은 id는 두 번 만들 수 없고 없는 id는 지울 수 없다. */
const fakeMenus = () => {
    const menus = new Set<string | number>();
    vi.spyOn(fakeBrowser.contextMenus, "create").mockImplementation(({id}) => {
        if (id === undefined || menus.has(id)) throw new Error(`duplicate id ${id}`);
        menus.add(id);
        return id;
    });
    vi.spyOn(fakeBrowser.contextMenus, "remove").mockImplementation(async (id) => {
        if (!menus.delete(id)) throw new Error(`no menu ${id}`);
    });
    return menus;
};

const apply = (enabled: boolean, patch: Record<string, boolean> = {}) => background.apply?.({enabled, settings: settingsOf(background, patch)});

describe("imagesearch 배경 apply", () => {
    it("켠 엔진마다 메뉴를 만들고, 두 번 맞춰도 이 모듈의 메뉴를 지운 뒤 만들어 겹치지 않는다", async () => {
        const menus = fakeMenus();
        menus.add("other");

        await apply(true, {googleLens: true});
        await apply(true, {googleLens: true, saucenao: false});

        expect([...menus]).toEqual(["other", "imagesearch:googleLens"]);
    });

    it("끄면 이 모듈의 메뉴만 지우고 만들지 않는다", async () => {
        const menus = fakeMenus();
        menus.add("other");
        await apply(true);

        await apply(false, {googleLens: true});

        expect([...menus]).toEqual(["other"]);
        expect(fakeBrowser.contextMenus.create).toHaveBeenCalledOnce();
    });
});

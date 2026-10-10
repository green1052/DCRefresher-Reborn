import {render} from "preact";
import {act} from "preact/test-utils";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {moduleSettingsStore, runningModulesStore} from "@/core/module/registry";
import {settingsOf} from "@/core/module/settings";
import type {SettingValue} from "@/core/storage/types";
import {UserCard} from "@/features/preview/ui/UserCard";
import userinfo from "@/features/userinfo/meta";

// 밴 DB는 저장소 대신 표로 두고, 이미 읽은 것(버전 1)으로 본다.
const bans = vi.hoisted(() => new Map<string, string>());
vi.mock("@/core/database", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/core/database")>(),
    databaseVersion: () => 1,
    subscribeDatabase: () => () => {},
    ipInfoOf: () => undefined,
    banReasonsOf: (uid: string) => bans.get(uid)
}));

let container: HTMLElement;

/** 유저 정보 모듈을 patch 설정으로 돌린다 (running이 false면 꺼진 것). */
const setUserinfo = (patch: Record<string, SettingValue>, running = true): void => {
    moduleSettingsStore.setState({userinfo: settingsOf(userinfo, patch)});
    runningModulesStore.setState({userinfo: running});
};

const badges = (): string[] =>
    Array.from(container.querySelectorAll(".refresher-user > span"), (span) => span.textContent ?? "");

const renderCard = (): void => {
    act(() => render(<UserCard user={{nick: "닉", id: "member"}}/>, container));
};

beforeEach(() => {
    bans.set("member", "어느갤");
    container = document.createElement("div");
    document.body.append(container);
});

afterEach(() => {
    act(() => render(null, container));
    container.remove();
    bans.clear();
    moduleSettingsStore.setState({}, true);
    runningModulesStore.setState({}, true);
});

describe("UserCard 갱차 배지", () => {
    it("갱차 조회를 켜면 보인다", () => {
        setUserinfo({checkPermBan: true});
        renderCard();
        expect(badges()).toEqual(["(member)", "[어느갤]"]);
    });

    it("갱차 조회를 끄면 숨긴다", () => {
        setUserinfo({checkPermBan: false});
        renderCard();
        expect(badges()).toEqual(["(member)"]);
    });

    it("유저 정보 모듈이 꺼져 있으면 갱차 조회 설정과 상관없이 숨긴다", () => {
        setUserinfo({checkPermBan: true}, false);
        renderCard();
        expect(badges()).toEqual(["(member)"]);
    });
});

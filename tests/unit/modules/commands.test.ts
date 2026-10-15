// @vitest-environment node
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import commands from "@/modules/commands";

import {fakeWxt, featureRoot} from "./fixture";

const meta = (id: string, list?: Record<string, { description: string; key?: string }>) => ({id, name: `${id} 모듈`, commands: list});

const setup = (metas: ReturnType<typeof meta>[]) => {
    const root = featureRoot({a: ["meta.ts"], b: ["meta.ts"], c: ["index.ts"]});
    const fake = fakeWxt(root, () => metas);
    void commands.setup?.(fake.wxt, {});
    return {...fake, root};
};

describe("commands 모듈", () => {
    it("메타의 단축키를 \"모듈 이름: 설명\"으로 manifest에 넣는다", async () => {
        const {generateManifest, importEntrypoints, root} = setup([meta("a", {next: {description: "다음", key: "Alt+N"}}), meta("b", {prev: {description: "이전"}})]);

        const manifest = await generateManifest({commands: {"wxt:reload-extension": {description: "dev"}}});

        // meta.ts가 있는 폴더만 한 번에 불러온다.
        expect(importEntrypoints).toHaveBeenCalledTimes(1);
        expect(importEntrypoints).toHaveBeenCalledWith([join(root, "features", "a", "meta.ts"), join(root, "features", "b", "meta.ts")]);
        expect(manifest.commands).toEqual({
            "wxt:reload-extension": {description: "dev"},
            next: {description: "a 모듈: 다음", suggested_key: {default: "Alt+N"}},
            prev: {description: "b 모듈: 이전"}
        });
    });

    it("단축키가 없으면 manifest를 건드리지 않는다", async () => {
        const {generateManifest} = setup([meta("a"), meta("b", {})]);
        expect(await generateManifest({})).toEqual({});
    });

    it("기본 키가 있는 명령이 dev 다시 불러오기를 더해 4개를 넘으면 던진다", async () => {
        const keys = (prefix: string, count: number) => Object.fromEntries(Array.from({length: count}, (_, i) => [`${prefix}${i}`, {description: "", key: `Alt+${prefix.toUpperCase()}${i}`}]));
        const reload = {"wxt:reload-extension": {description: "dev", suggested_key: {default: "Alt+Shift+R"}}};

        await expect(setup([meta("a", keys("a", 2)), meta("b", {...keys("b", 1), free: {description: ""}})]).generateManifest({commands: {...reload}})).resolves.toBeDefined();
        await expect(setup([meta("a", keys("a", 2)), meta("b", keys("b", 2))]).generateManifest({commands: {...reload}}))
            .rejects.toThrow("크롬은 기본 단축키를 4개까지만 받습니다 (지금 5개)");
    });

    it("이름이 겹치면 던진다", async () => {
        const {generateManifest} = setup([meta("a", {go: {description: ""}}), meta("b", {go: {description: ""}})]);
        await expect(generateManifest({})).rejects.toThrow("단축키 이름이 겹칩니다: go (b)");
    });
});

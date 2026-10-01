import {describe, expect, it} from "vitest";

import type {AnyModule} from "@/core/module/types";

const modules = Object.values(import.meta.glob<AnyModule>("@/features/*/index.ts", {eager: true, import: "default"}));

describe("단축키", () => {
    it("모듈의 shortcuts와 메타의 commands 이름이 같다 (한쪽만 고치면 단축키가 동작하지 않거나 manifest에 빠진다)", () => {
        expect(modules.length).toBeGreaterThan(5);
        for (const module of modules) {
            expect(Object.keys(module.shortcuts ?? {}).sort(), module.id).toEqual(Object.keys(module.commands ?? {}).sort());
        }
    });
});

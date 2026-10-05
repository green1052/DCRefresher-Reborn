// @vitest-environment node
import {describe, expect, it} from "vitest";

import moduleTypes from "@/modules/module-types";

import {fakeWxt, featureRoot} from "./fixture";

describe("module-types 모듈", () => {
    it("index.ts로 ModuleApis, meta.ts로 ModuleSettings를 채운다", async () => {
        const {wxt, prepareTypes} = fakeWxt(featureRoot({b: ["index.ts", "meta.ts"], a: ["index.ts"], c: ["meta.ts"]}));
        void moduleTypes.setup?.(wxt, {});

        const [entry] = await prepareTypes();

        expect(entry).toMatchObject({path: "types/modules.d.ts", tsReference: true});
        const text = entry && "text" in entry ? entry.text : "";
        expect(text).toContain('interface ModuleApis extends ModuleApiMap<typeof import("@/features/a/index").default | typeof import("@/features/b/index").default> {}');
        expect(text).toContain('interface ModuleSettings extends ModuleSettingsMap<typeof import("@/features/b/meta").default | typeof import("@/features/c/meta").default> {}');
        expect(text).toContain('declare module "@/core/module/types"');
    });
});

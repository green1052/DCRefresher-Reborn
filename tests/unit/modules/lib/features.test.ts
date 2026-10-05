// @vitest-environment node
import {writeFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import {featureFolders} from "@/modules/lib/features";

import {featureRoot} from "../fixture";

describe("featureFolders", () => {
    it("그 파일이 있는 폴더만 이름순으로", () => {
        const root = featureRoot({zeta: ["meta.ts"], alpha: ["meta.ts", "index.ts"], beta: ["index.ts"]});
        // 폴더가 아닌 같은 이름의 파일은 모듈이 아니다.
        writeFileSync(join(root, "features", "meta.ts"), "");

        expect(featureFolders(root, "meta.ts")).toEqual(["alpha", "zeta"]);
        expect(featureFolders(root, "index.ts")).toEqual(["alpha", "beta"]);
        expect(featureFolders(root, "page.css")).toEqual([]);
    });
});

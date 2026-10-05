// @vitest-environment node
import {describe, expect, it} from "vitest";

import featureStyles from "@/modules/feature-styles";

import {fakeWxt, featureRoot} from "./fixture";

describe("feature-styles 모듈", () => {
    it("page.css가 있는 기능만 이름순으로 @import한다", async () => {
        const {wxt, prepareTypes} = fakeWxt(featureRoot({zeta: ["page.css"], alpha: ["page.css"], beta: ["index.ts"]}));
        void featureStyles.setup?.(wxt, {});

        const [entry] = await prepareTypes();

        expect(entry).toMatchObject({path: "page-styles.css"});
        const imports = entry && "text" in entry ? entry.text.split("\n").filter((line) => line.startsWith("@import")) : [];
        expect(imports).toEqual(['@import "../features/alpha/page.css";', '@import "../features/zeta/page.css";']);
    });
});

import {describe, expect, it} from "vitest";

import {featureFolders} from "../../../../modules/lib/features";

describe("featureFolders", () => {
    it("파일이 있는 기능 폴더만 이름순으로 돌려준다", () => {
        const metas = featureFolders(process.cwd(), "meta.ts");
        // 모든 기능이 meta.ts를 가진다. 정렬이고, 없는 파일을 걸러낸다.
        expect(metas).toEqual([...metas].sort());
        expect(metas).toContain("preview");
        expect(metas).toContain("block");
        expect(featureFolders(process.cwd(), "없는-파일")).toEqual([]);

        // 페이지 코드가 없는 모듈(imagesearch)은 index.ts 목록에 없다.
        const indexes = featureFolders(process.cwd(), "index.ts");
        expect(indexes).toContain("preview");
        expect(indexes).not.toContain("imagesearch");
    });
});

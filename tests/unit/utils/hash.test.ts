import {describe, expect, it} from "vitest";

import {hash53} from "@/utils/hash";

describe("hash53", () => {
    it("같은 글자는 같은 값, 한 글자만 달라도 다른 값을 낸다", () => {
        const row = "<tr><td class=\"gall_num\">1</td><td class=\"gall_tit\"><a>제목</a></td></tr>";
        expect(hash53(row)).toBe(hash53(row));
        expect(hash53(row)).not.toBe(hash53(row.replace("제목", "제묵")));
        expect(Number.isSafeInteger(hash53(row))).toBe(true);
    });
});

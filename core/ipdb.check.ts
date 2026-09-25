// ipdb 자체 점검: bun core/ipdb.check.ts
import {compactIpData, createIpLookup, type RawIpData} from "./ipdb";

const raw: RawIpData = {
    meta: [{o: "SoftBank Corp.", c: "일본"}, {o: "KT"}, {o: "Tencent", c: "중국", v: 1}, {c: "호주", v: 1}],
    b: {"1.5": [0], "1.6": [0], "14.63": [1, 2], "223.223": [1, 2], "8.8": [3]}
};

const lookup = createIpLookup(compactIpData(raw));
const expect = (ip: string, want: unknown): void => {
    const got = JSON.stringify(lookup(ip));
    if (got !== JSON.stringify(want)) throw new Error(`${ip}: ${got} !== ${JSON.stringify(want)}`);
};

expect("1.5", [{org: "SoftBank Corp.", country: "일본", vpn: false}]);
expect("14.63", [{org: "KT", vpn: false}, {org: "Tencent", country: "중국", vpn: true}]);
expect("223.223", [{org: "KT", vpn: false}, {org: "Tencent", country: "중국", vpn: true}]);
expect("8.8", [{country: "호주", vpn: true}]);
expect("1.7", undefined);
expect("999.1", undefined);
expect("", undefined);

console.log("ipdb ok");

let rejected = false;
try {
    compactIpData({"1.5": "KT"} as unknown as RawIpData);
} catch {
    rejected = true;
}
if (!rejected) throw new Error("old format should be rejected");
console.log("old format rejected");

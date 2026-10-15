import type {Route} from "@playwright/test";

import {encodeIpData} from "../core/ipdb";

/**
 * 가짜 IP·밴 DB 서버 (dcrefresher.green1052.com). 크로미엄은 context.route가 서비스 워커 요청도 가로채 배경이 이것을 받는다.
 * ip.json은 가짜 목록의 유동 ㅇㅇ(1.2) 대역에 통신사 하나만 둔다.
 */
export class FakeIpDb {
    readonly version = "2026-01-01T00:00";

    /** 1.2 대역의 통신사. 유동 행에 [ORG] 배지로 붙는다. */
    readonly org = "테스트통신";

    /** 갤러리 → 갱차된 uid. */
    readonly bans = {"테스트 갤러리": ["user1"]};

    /** 받은 요청 경로 (/version, /ip.json, /ban.json). */
    readonly requests: string[] = [];

    readonly handle = (route: Route): Promise<void> => {
        const {pathname} = new URL(route.request().url());
        this.requests.push(pathname);
        const body = new Map([
            ["/version", this.version],
            ["/ip.json", JSON.stringify({version: this.version, ...encodeIpData(new Map([[1 * 256 + 2, [{org: this.org, vpn: false}]]]))})],
            ["/ban.json", JSON.stringify(this.bans)]
        ]).get(pathname);
        return body === undefined ? route.fulfill({status: 404}) : route.fulfill({body});
    };
}

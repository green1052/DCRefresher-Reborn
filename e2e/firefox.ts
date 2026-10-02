import net from "node:net";

/**
 * Playwright의 파이어폭스는 크로미엄처럼 실행 인자로 확장을 올릴 수 없다. 그래서 web-ext처럼
 * 파이어폭스의 원격 디버깅 서버(-start-debugger-server)에 붙어 임시 부가 기능으로 설치한다 (Remote Debugging Protocol).
 */

/** 디버깅 서버를 켜고, 붙을 때 확인 창을 띄우지 않게 하는 설정. */
export const firefoxUserPrefs = (): Record<string, string | number | boolean> => ({
    "devtools.debugger.remote-enabled": true,
    "devtools.debugger.prompt-connection": false,
    "devtools.chrome.enabled": true,
    // 서명 안 된 임시 부가 기능이라 서명 검사는 상관없지만, 설치 직후 업데이트 확인 등으로 바깥에 요청하지 않게 한다.
    "extensions.update.enabled": false,
    "extensions.getAddons.cache.enabled": false
});

/** 비어 있는 TCP 포트. */
export const freePort = (): Promise<number> =>
    new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            server.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("포트를 얻지 못했습니다."))));
        });
    });

type Packet = Record<string, unknown> & { from?: string; error?: string; message?: string };

interface Client {
    /** 요청을 보내고 그 actor가 보낸 다음 패킷을 응답으로 받는다. */
    request(packet: Packet & { to: string }): Promise<Packet>;
    /** from actor가 보낸 패킷 중 match에 맞는 것을 기다린다 (evaluateJSAsync의 결과처럼 나중에 오는 패킷). */
    receive(from: string, match: (packet: Packet) => boolean): Promise<Packet>;
    close(): void;
}

/** RDP 연결. 패킷은 "길이:JSON"이다. 요청은 한 번에 하나씩 보낸다. */
const connect = async (port: number): Promise<Client> => {
    // 브라우저가 뜬 직후에는 서버가 아직 없을 수 있어 잠시 다시 붙는다.
    let socket: net.Socket | undefined;
    for (let attempt = 0; attempt < 100 && !socket; attempt++) {
        socket = await new Promise<net.Socket | undefined>((resolve) => {
            const candidate = net.connect(port, "127.0.0.1");
            candidate.once("connect", () => resolve(candidate));
            candidate.once("error", () => resolve(undefined));
        });
        if (!socket) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!socket) throw new Error(`파이어폭스 디버깅 서버(${port})에 붙지 못했습니다.`);

    // 받았지만 아직 아무도 기다리지 않는 패킷과, 패킷을 기다리는 쪽. 패킷은 맞는 쪽 하나에만 간다.
    const unclaimed: Packet[] = [];
    const waiters: { match: (packet: Packet) => boolean; resolve: (packet: Packet) => void }[] = [];
    const deliver = (packet: Packet): void => {
        const index = waiters.findIndex((waiter) => waiter.match(packet));
        if (index < 0) unclaimed.push(packet);
        else waiters.splice(index, 1)[0]!.resolve(packet);
    };

    let buffer = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        for (;;) {
            const colon = buffer.indexOf(":");
            if (colon < 0) break;
            const length = Number(buffer.subarray(0, colon).toString());
            if (buffer.length < colon + 1 + length) break;
            deliver(JSON.parse(buffer.subarray(colon + 1, colon + 1 + length).toString()) as Packet);
            buffer = buffer.subarray(colon + 1 + length);
        }
    });

    const wait = (match: (packet: Packet) => boolean): Promise<Packet> => {
        const index = unclaimed.findIndex(match);
        if (index >= 0) return Promise.resolve(unclaimed.splice(index, 1)[0]!);
        return new Promise((resolve) => waiters.push({match, resolve}));
    };
    const receive = (from: string, match: (packet: Packet) => boolean): Promise<Packet> => wait((packet) => packet.from === from && match(packet));

    // 처음에 root가 인사 패킷을 보낸다.
    await receive("root", () => true);

    // 요청의 응답은 type이 없거나 요청과 같은 패킷이다. 같은 actor의 알림(type이 다른 이벤트)과 섞지 않는다.
    const request = async (packet: Packet & { to: string }): Promise<Packet> => {
        const reply = receive(packet.to, (candidate) => candidate.type === undefined || candidate.type === packet.type || Boolean(candidate.error));
        const json = Buffer.from(JSON.stringify(packet));
        socket.write(`${json.length}:`);
        socket.write(json);
        const result = await reply;
        if (result.error) throw new Error(`${packet.type}: ${result.error} ${result.message ?? ""}`);
        return result;
    };

    return {request, receive, close: () => socket.destroy()};
};

/** 설치한 부가 기능. 배경 페이지에서 코드를 돌린다. */
export interface FirefoxAddon {
    /**
     * 배경 페이지에서 식을 계산해 JSON으로 돌려받는다. 식은 Promise여도 된다.
     * 플레이라이트의 파이어폭스는 moz-extension:// 페이지로 이동하지 못해(page.goto가 끝나지 않는다) 배경에 직접 붙는다.
     */
    evaluate<T>(expression: string): Promise<T>;
    close(): void;
}

/** 압축을 푼 확장 폴더를 임시 부가 기능으로 설치하고, 연결을 남겨 배경 페이지에서 코드를 돌릴 수 있게 한다. */
export const installTemporaryAddon = async (port: number, addonPath: string): Promise<FirefoxAddon> => {
    const client = await connect(port);
    try {
        const root = await client.request({to: "root", type: "getRoot"});
        const addonsActor = root.addonsActor;
        if (typeof addonsActor !== "string") throw new Error("파이어폭스 디버깅 서버에 addonsActor가 없습니다.");
        const {addon} = await client.request({to: addonsActor, type: "installTemporaryAddon", addonPath}) as { addon?: { id?: string } };

        const {addons} = await client.request({to: "root", type: "listAddons"}) as { addons?: { id: string; actor: string }[] };
        const descriptor = addons?.find((entry) => entry.id === addon?.id)?.actor;
        if (!descriptor) throw new Error("설치한 부가 기능을 찾지 못했습니다.");
        // 배경 페이지는 watcher가 알려 주는 target이다 (getTarget은 파이어폭스에서 빠졌다).
        const {actor: watcher} = await client.request({to: descriptor, type: "getWatcher"}) as { actor?: string };
        if (!watcher) throw new Error("부가 기능의 watcher가 없습니다.");
        // 대체 문서(resource://devtools-webextension-fallback)도 target으로 오므로 확장 주소인 것을 고른다.
        const isBackground = (packet: Packet): boolean =>
            packet.type === "target-available-form" && String((packet.target as { url?: string } | undefined)?.url).startsWith("moz-extension://");
        const available = client.receive(watcher, isBackground);
        await client.request({to: watcher, type: "watchTargets", targetType: "frame"});
        const {target} = await available as { target?: { consoleActor?: string; url?: string } };
        const consoleActor = target?.consoleActor;
        if (!consoleActor) throw new Error("부가 기능 배경 페이지의 consoleActor가 없습니다.");

        // 요청이 겹치면 응답 순서가 섞이므로 하나씩 보낸다.
        let queue: Promise<unknown> = Promise.resolve();
        const evaluate = <T>(expression: string): Promise<T> => {
            const run = async (): Promise<T> => {
                const {resultID} = await client.request({to: consoleActor, type: "evaluateJSAsync", text: `(async () => JSON.stringify(await (${expression}) ?? null))()`, mapped: {await: true}});
                const result = await client.receive(consoleActor, (packet) => packet.type === "evaluationResult" && packet.resultID === resultID);
                if (result.hasException) throw new Error(`배경 페이지에서 실패했습니다: ${JSON.stringify(result.exceptionMessage ?? result.exception)}`);
                return JSON.parse(String(result.result)) as T;
            };
            const done = queue.then(run, run);
            queue = done.catch(() => {});
            return done;
        };
        return {evaluate, close: () => client.close()};
    } catch (error) {
        client.close();
        throw error;
    }
};

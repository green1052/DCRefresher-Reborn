import net from "node:net";

/**
 * Playwright의 파이어폭스는 크로미엄처럼 실행 인자로 확장을 올릴 수 없다. 그래서 web-ext처럼
 * 파이어폭스의 원격 디버깅 서버(-start-debugger-server)에 붙어 임시 부가 기능으로 설치한다 (Remote Debugging Protocol).
 */

/** 확장 내부 UUID. 고정해 두면 moz-extension:// 주소를 미리 안다 (extensions.webextensions.uuids). */
export const FIREFOX_EXTENSION_UUID = "6f1d2c3b-0e4a-4c5d-9b8a-7e6f5d4c3b2a";
export const GECKO_ID = "dcrefresher-reborn@green1052";

/** 디버깅 서버를 켜고, 붙을 때 확인 창을 띄우지 않게 하는 설정. */
export const firefoxUserPrefs = (): Record<string, string | number | boolean> => ({
    "devtools.debugger.remote-enabled": true,
    "devtools.debugger.prompt-connection": false,
    "devtools.chrome.enabled": true,
    "extensions.webextensions.uuids": JSON.stringify({[GECKO_ID]: FIREFOX_EXTENSION_UUID}),
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

/** RDP 연결. 패킷은 "길이:JSON"이다. 요청은 한 번에 하나씩 보내고, 그 actor가 보낸 다음 패킷을 응답으로 받는다. */
const connect = async (port: number): Promise<{ request: (packet: Packet & { to: string }) => Promise<Packet>; close: () => void }> => {
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

    let buffer = Buffer.alloc(0);
    const queue: Packet[] = [];
    const waiters: ((packet: Packet) => void)[] = [];
    socket.on("data", (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        for (;;) {
            const colon = buffer.indexOf(":");
            if (colon < 0) break;
            const length = Number(buffer.subarray(0, colon).toString());
            if (buffer.length < colon + 1 + length) break;
            const packet = JSON.parse(buffer.subarray(colon + 1, colon + 1 + length).toString()) as Packet;
            buffer = buffer.subarray(colon + 1 + length);
            const waiter = waiters.shift();
            if (waiter) waiter(packet);
            else queue.push(packet);
        }
    });
    const next = (): Promise<Packet> => new Promise((resolve) => {
        const packet = queue.shift();
        if (packet) resolve(packet);
        else waiters.push(resolve);
    });

    // 처음에 root가 인사 패킷을 보낸다.
    await next();

    const request = async (packet: Packet & { to: string }): Promise<Packet> => {
        const json = Buffer.from(JSON.stringify(packet));
        socket.write(`${json.length}:`);
        socket.write(json);
        // 다른 actor의 알림(탭 목록 변경 등)은 건너뛴다.
        for (;;) {
            const reply = await next();
            if (reply.from !== packet.to) continue;
            if (reply.error) throw new Error(`${packet.type}: ${reply.error} ${reply.message ?? ""}`);
            return reply;
        }
    };

    return {request, close: () => socket.destroy()};
};

/** 압축을 푼 확장 폴더를 임시 부가 기능으로 설치한다. */
export const installTemporaryAddon = async (port: number, addonPath: string): Promise<void> => {
    const client = await connect(port);
    try {
        const root = await client.request({to: "root", type: "getRoot"});
        const addonsActor = root.addonsActor;
        if (typeof addonsActor !== "string") throw new Error("파이어폭스 디버깅 서버에 addonsActor가 없습니다.");
        await client.request({to: addonsActor, type: "installTemporaryAddon", addonPath});
    } finally {
        client.close();
    }
};

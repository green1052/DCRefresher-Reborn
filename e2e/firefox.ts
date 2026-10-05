import net from "node:net";

/**
 * 플레이라이트의 파이어폭스는 실행 인자로 확장을 올리지 못한다. web-ext처럼 원격 디버깅 서버(-start-debugger-server)에 붙어
 * 압축을 푼 확장을 임시 부가 기능으로 설치하고, 같은 연결로 배경 페이지에서 식을 계산한다 (Remote Debugging Protocol).
 * 패킷은 "바이트 길이:JSON"이다. 요청에 대한 응답은 그 actor가 보내는 type 없는 패킷이고 요청 순서대로 온다.
 * type이 있는 패킷은 알림(이벤트)이다.
 */

/** 디버깅 서버를 켜고 붙을 때 확인 창을 띄우지 않는 설정. */
export const DEBUGGER_PREFS = {
    "devtools.debugger.remote-enabled": true,
    "devtools.debugger.prompt-connection": false,
    "devtools.chrome.enabled": true,
    "extensions.update.enabled": false,
    "extensions.getAddons.cache.enabled": false
};

/**
 * 실제 네트워크를 막는 설정. context.route는 배경 페이지의 요청을 가로채지 못해, 막지 않으면 배경이 실제 IP DB를 받아
 * 가짜 목록의 유동 행에도 IP 배지가 붙는다. 없는 프록시로 보내 바로 실패하게 한다. 페이지 요청은 route가 먼저 응답한다.
 */
export const OFFLINE_PREFS = {
    "network.proxy.type": 1,
    "network.proxy.http": "127.0.0.1",
    "network.proxy.http_port": 9,
    "network.proxy.ssl": "127.0.0.1",
    "network.proxy.ssl_port": 9,
    "network.proxy.no_proxies_on": ""
};

/** 비어 있는 TCP 포트. */
export const freePort = (): Promise<number> =>
    new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            server.close(() => (address && typeof address === "object" ? resolve(address.port) : reject(new Error("포트를 얻지 못했습니다."))));
        });
    });

interface Packet {
    from: string;
    type?: string;
    error?: string;
    message?: string;

    [key: string]: unknown;
}

/** 응답 하나를 기다리는 시간(ms). 테스트 시간 제한보다 짧아 어디서 멈췄는지 알린다. */
const PACKET_TIMEOUT = 20_000;

const withTimeout = <T>(promise: Promise<T>, what: string): Promise<T> =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`파이어폭스 디버깅 서버에서 ${what}이(가) 오지 않았습니다.`)), PACKET_TIMEOUT);
        promise.then(resolve, reject).finally(() => clearTimeout(timer));
    });

const openSocket = async (port: number): Promise<net.Socket> => {
    // 브라우저가 뜬 직후에는 서버가 아직 없을 수 있다.
    for (let attempt = 0; attempt < 100; attempt++) {
        const socket = await new Promise<net.Socket | null>((resolve) => {
            const candidate = net.connect(port, "127.0.0.1");
            candidate.once("connect", () => resolve(candidate));
            candidate.once("error", () => resolve(null));
        });
        if (socket) return socket;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`파이어폭스 디버깅 서버(${port})에 붙지 못했습니다.`);
};

class RdpClient {
    /** actor마다 응답을 기다리는 요청 (보낸 순서). */
    private readonly replies = new Map<string, { resolve: (packet: Packet) => void; reject: (error: Error) => void }[]>();
    /** 알림을 기다리는 쪽. 맞는 알림 하나를 받으면 빠진다. */
    private readonly listeners = new Set<(packet: Packet) => boolean>();
    private buffer = Buffer.alloc(0);

    private constructor(private readonly socket: net.Socket) {
        socket.on("data", (chunk: Buffer) => this.receive(chunk));
    }

    static async connect(port: number): Promise<RdpClient> {
        const client = new RdpClient(await openSocket(port));
        // 붙으면 root가 type 없는 인사 패킷을 먼저 보낸다. 응답처럼 받아 둔다.
        await withTimeout(client.reply("root"), "인사");
        return client;
    }

    private receive(chunk: Buffer): void {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        for (;;) {
            const colon = this.buffer.indexOf(":");
            if (colon < 0) return;
            const length = Number(this.buffer.subarray(0, colon).toString());
            const end = colon + 1 + length;
            if (this.buffer.length < end) return;
            const packet = JSON.parse(this.buffer.subarray(colon + 1, end).toString()) as Packet;
            this.buffer = this.buffer.subarray(end);
            this.dispatch(packet);
        }
    }

    private dispatch(packet: Packet): void {
        if (packet.type === undefined) {
            const waiter = this.replies.get(packet.from)?.shift();
            if (packet.error) waiter?.reject(new Error(`${packet.from}: ${packet.error} ${packet.message ?? ""}`));
            else waiter?.resolve(packet);
            return;
        }
        for (const listener of this.listeners) {
            if (listener(packet)) {
                this.listeners.delete(listener);
                return;
            }
        }
    }

    private reply(actor: string): Promise<Packet> {
        return new Promise((resolve, reject) => {
            const queue = this.replies.get(actor) ?? [];
            queue.push({resolve, reject});
            this.replies.set(actor, queue);
        });
    }

    request(to: string, type: string, params: Record<string, unknown> = {}): Promise<Packet> {
        const reply = this.reply(to);
        const json = Buffer.from(JSON.stringify({to, type, ...params}));
        this.socket.write(Buffer.concat([Buffer.from(`${json.length}:`), json]));
        return withTimeout(reply, `${to}의 ${type} 응답`);
    }

    /** from이 보내는 type 알림 중 match에 맞는 것. 알림을 일으키는 요청보다 먼저 불러야 놓치지 않는다. */
    event(from: string, type: string, match: (packet: Packet) => boolean = () => true): Promise<Packet> {
        const received = new Promise<Packet>((resolve) => {
            this.listeners.add((packet) => {
                if (packet.from !== from || packet.type !== type || !match(packet)) return false;
                resolve(packet);
                return true;
            });
        });
        return withTimeout(received, `${from}의 ${type} 알림`);
    }

    close(): void {
        this.socket.destroy();
    }
}

/** 설치한 부가 기능. */
export interface FirefoxAddon {
    /**
     * 배경 페이지에서 식(Promise여도 된다)을 계산해 JSON으로 돌려받는다.
     * 플레이라이트의 파이어폭스는 moz-extension:// 페이지로 이동하지 못해 배경에 직접 붙는다.
     */
    evaluate<T>(expression: string): Promise<T>;

    close(): void;
}

/** 압축을 푼 확장 폴더(addonPath)를 임시 부가 기능으로 설치하고 배경 페이지에 붙는다. */
export const installTemporaryAddon = async (port: number, addonPath: string): Promise<FirefoxAddon> => {
    const client = await RdpClient.connect(port);
    try {
        const {addonsActor} = await client.request("root", "getRoot");
        if (typeof addonsActor !== "string") throw new Error("디버깅 서버에 addonsActor가 없습니다.");
        // 응답의 addon은 {id, actor: false}다. actor는 부가 기능 목록에서 찾는다.
        const {addon} = await client.request(addonsActor, "installTemporaryAddon", {addonPath, openDevTools: false}) as Packet & { addon?: { id?: string } };
        const {addons} = await client.request("root", "listAddons") as Packet & { addons?: { id: string; actor: string }[] };
        const descriptor = addons?.find(({id}) => id === addon?.id)?.actor;
        if (!descriptor) throw new Error("설치한 부가 기능을 찾지 못했습니다.");

        // 부가 기능의 문서(target)는 watcher가 알린다. 배경 페이지 말고 대체 문서(resource://)도 오므로 확장 주소인 것을 기다린다.
        const {actor: watcher} = await client.request(descriptor, "getWatcher");
        if (typeof watcher !== "string") throw new Error("부가 기능의 watcher가 없습니다.");
        const background = client.event(watcher, "target-available-form", (packet) => {
            const target = packet.target as { url?: string } | undefined;
            return Boolean(target?.url?.startsWith("moz-extension://"));
        });
        await client.request(watcher, "watchTargets", {targetType: "frame"});
        const consoleActor = ((await background).target as { consoleActor?: string }).consoleActor;
        if (!consoleActor) throw new Error("배경 페이지의 consoleActor가 없습니다.");

        // 결과(evaluationResult)는 resultID로만 짝지을 수 있어, 요청을 하나씩 보내 섞이지 않게 한다.
        let queue: Promise<unknown> = Promise.resolve();
        const run = async <T>(expression: string): Promise<T> => {
            // 결과를 JSON 문자열 하나로 받는다. {value}로 감싸 undefined(없는 키)도 그대로 돌아오고, 실패는 {error}로 온다.
            // 서버는 거부된 Promise의 이유를 주지 않으므로(topLevelAwaitRejected) 식 안에서 잡는다.
            const text = `(async () => { try { return JSON.stringify({value: await (${expression})}); } catch (e) { return JSON.stringify({error: String(e)}); } })()`;
            const result = client.event(consoleActor, "evaluationResult");
            // mapped.await: 식이 낸 Promise를 서버가 기다려 그 값을 준다.
            await client.request(consoleActor, "evaluateJSAsync", {text, mapped: {await: true}});
            const {exceptionMessage, result: grip} = await result as Packet & { exceptionMessage?: unknown; result?: string | { type?: string; actor?: string; length?: number } };
            // 긴 문자열(1만 자 넘음)은 값 대신 longString grip으로 온다.
            const json = typeof grip === "string" ? grip
                : grip?.type === "longString" && grip.actor ? String((await client.request(grip.actor, "substring", {start: 0, end: grip.length})).substring)
                    : undefined;
            if (json === undefined) throw new Error(`배경 페이지에서 계산하지 못했습니다: ${JSON.stringify(exceptionMessage ?? grip)}`);
            const {value, error} = JSON.parse(json) as { value: T; error?: string };
            if (error !== undefined) throw new Error(`배경 페이지에서 실패했습니다: ${error}`);
            return value;
        };
        return {
            evaluate: <T>(expression: string): Promise<T> => {
                const done = queue.then(() => run<T>(expression));
                queue = done.catch(() => undefined);
                return done;
            },
            close: () => client.close()
        };
    } catch (e) {
        client.close();
        throw e;
    }
};

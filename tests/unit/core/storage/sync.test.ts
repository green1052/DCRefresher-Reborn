import {afterEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {storageSync, typedListSync, watchStorage} from "@/core/storage/sync";

import {stored, tick} from "../../../helpers";

const contexts: AbortController[] = [];
/** 테스트가 끝나면 끝나는 컨텍스트 signal. 앞 테스트의 bfcache 리스너가 남지 않게 한다. */
const contextSignal = (): AbortSignal => {
    const controller = new AbortController();
    contexts.push(controller);
    return controller.signal;
};
afterEach(() => {
    for (const controller of contexts.splice(0)) controller.abort();
});

const restoreFromBfcache = () => window.dispatchEvent(new PageTransitionEvent("pageshow", {persisted: true}));

describe("watchStorage", () => {
    it("값이 바뀌면 새 값·옛 값으로 부른다", async () => {
        const callback = vi.fn();
        watchStorage("local:k", callback);

        await fakeBrowser.storage.local.set({k: 1});
        await fakeBrowser.storage.local.set({k: 2});

        expect(callback.mock.calls).toEqual([[1, null], [2, 1]]);
    });

    it("signal이 끝나거나 돌려준 함수를 부르면 멈춘다", async () => {
        const controller = new AbortController();
        const bySignal = vi.fn();
        const byDispose = vi.fn();
        watchStorage("local:k", bySignal, controller.signal);
        watchStorage("local:k", byDispose)();

        controller.abort();
        await fakeBrowser.storage.local.set({k: 1});

        expect(bySignal).not.toHaveBeenCalled();
        expect(byDispose).not.toHaveBeenCalled();
    });

    it("이미 끝난 signal이면 걸지 않는다", async () => {
        const callback = vi.fn();
        watchStorage("local:k", callback, AbortSignal.abort());

        await fakeBrowser.storage.local.set({k: 1});

        expect(callback).not.toHaveBeenCalled();
    });
});

describe("storageSync", () => {
    const keys = ["local:a", "local:b"] as const;

    it("start는 한 번만 읽고 없는 키는 null로 넘긴다", async () => {
        await fakeBrowser.storage.local.set({a: 1});
        const apply = vi.fn();
        const sync = storageSync(keys, apply);

        await Promise.all([sync.start(contextSignal()), sync.start(contextSignal())]);

        expect(apply.mock.calls).toEqual([["local:a", 1], ["local:b", null]]);
    });

    it("읽는 사이 바뀐 키는 옛 값으로 덮지 않는다", async () => {
        await fakeBrowser.storage.local.set({a: "old", b: "old"});
        const get = fakeBrowser.storage.local.get.bind(fakeBrowser.storage.local);
        vi.spyOn(fakeBrowser.storage.local, "get").mockImplementationOnce(async (query) => {
            const read = await get(query);
            await fakeBrowser.storage.local.set({a: "new"});
            return read;
        });
        const values = new Map<string, unknown>();
        const sync = storageSync(keys, (key, value) => values.set(key, value));

        await sync.start(contextSignal());

        expect(values).toEqual(new Map([["local:a", "new"], ["local:b", "old"]]));
    });

    it("읽기가 실패하면 감시를 풀고 다음 start가 다시 한다", async () => {
        vi.spyOn(fakeBrowser.storage.local, "get").mockRejectedValueOnce(new Error("read"));
        const apply = vi.fn();
        const sync = storageSync(keys, apply);

        await expect(sync.start(contextSignal())).rejects.toThrow("read");
        await sync.start(contextSignal());
        apply.mockClear();
        await fakeBrowser.storage.local.set({a: 1});

        // 감시가 두 번 걸렸으면 두 번 불린다.
        expect(apply).toHaveBeenCalledTimes(1);
    });

    it("signal이 끝나면 감시를 푼다", async () => {
        const controller = new AbortController();
        const apply = vi.fn();
        await storageSync(keys, apply).start(controller.signal);
        apply.mockClear();

        controller.abort();
        await fakeBrowser.storage.local.set({a: 1});

        expect(apply).not.toHaveBeenCalled();
    });

    it("bfcache에서 돌아오면 다시 읽는다", async () => {
        const apply = vi.fn();
        await storageSync(keys, apply).start(contextSignal());
        vi.spyOn(fakeBrowser.storage.local.onChanged, "trigger").mockResolvedValue([]);
        await fakeBrowser.storage.local.set({b: 2});
        apply.mockClear();

        restoreFromBfcache();

        await vi.waitFor(() => expect(apply).toHaveBeenCalledWith("local:b", 2));
    });
});

describe("typedListSync", () => {
    type Lists = Record<"X" | "Y", string[]>;

    const create = (extra?: Partial<Record<`local:${string}`, (value: unknown) => void>>) => {
        let lists: Lists = {X: [], Y: []};
        const set = vi.fn((next: Lists) => void (lists = next));
        const sync = typedListSync({
            types: ["X", "Y"] as const,
            keyOf: (type) => `local:list:${type}`,
            normalize: (value) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []),
            get: () => lists,
            set,
            failure: "failed",
            extra,
            lock: "test"
        });
        return {sync, set, lists: () => lists};
    };

    it("저장소 값을 normalize해 넣고, 같은 값이면 건드리지 않는다", async () => {
        await fakeBrowser.storage.local.set({"list:X": ["a", 1]});
        const {sync, set, lists} = create();
        await sync.start(contextSignal());
        expect(lists()).toEqual({X: ["a"], Y: []});
        set.mockClear();

        // 정규화하면 같은 값이다.
        await fakeBrowser.storage.local.set({"list:X": ["a", 2]});
        expect(set).not.toHaveBeenCalled();

        await fakeBrowser.storage.local.set({"list:Y": ["b"]});
        expect(lists()).toEqual({X: ["a"], Y: ["b"]});
    });

    it("extra 키는 그 함수로 넘긴다", async () => {
        const defaults = vi.fn();
        await fakeBrowser.storage.local.set({extra: "v"});
        const {sync} = create({"local:extra": defaults});

        await sync.start(contextSignal());

        expect(defaults).toHaveBeenCalledWith("v");
    });

    it("save는 스토어에 먼저 넣고 저장한다", async () => {
        const {sync, lists} = create();

        const saving = sync.save("X", ["a"]);
        expect(lists().X).toEqual(["a"]);
        await saving;

        expect(await stored("list:X")).toEqual(["a"]);
    });

    it("save가 실패하면 저장소 값으로 되돌리고 던진다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        await fakeBrowser.storage.local.set({"list:X": ["kept"]});
        const {sync, lists} = create();
        await sync.start(contextSignal());
        vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValueOnce(new Error("quota"));

        await expect(sync.save("X", ["lost"])).rejects.toThrow("quota");

        expect(lists().X).toEqual(["kept"]);
    });

    it("update는 다른 창이 쓴 저장소 값에 붙인다", async () => {
        const {sync, lists} = create();
        await sync.start(contextSignal());
        // 이 창은 아직 알림을 받지 못했다.
        const trigger = vi.spyOn(fakeBrowser.storage.local.onChanged, "trigger").mockResolvedValue([]);
        await fakeBrowser.storage.local.set({"list:X": ["other"]});
        trigger.mockRestore();

        await sync.update("X", (current) => [...current, "mine"]);

        expect(await stored("list:X")).toEqual(["other", "mine"]);
        expect(lists().X).toEqual(["other", "mine"]);
    });

    it("동시에 부른 update는 차례로 써서 서로 덮지 않는다", async () => {
        const {sync} = create();

        await Promise.all([sync.update("X", (current) => [...current, "a"]), sync.update("X", (current) => [...current, "b"])]);

        expect(await stored("list:X")).toEqual(["a", "b"]);
    });

    it("update가 실패하면 되돌리고 던진다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const {sync, lists} = create();
        await sync.start(contextSignal());
        vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValueOnce(new Error("quota"));

        await expect(sync.update("X", (current) => [...current, "a"])).rejects.toThrow("quota");
        await tick();

        expect(lists().X).toEqual([]);
    });
});

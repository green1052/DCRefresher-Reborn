/** modules/ 테스트 도우미: 임시 features 폴더와 훅만 받는 가짜 wxt. */
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {afterEach, vi} from "vitest";
import type {Wxt, WxtDirEntry} from "wxt";

const roots: string[] = [];
afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, {recursive: true, force: true});
});

/** features/<폴더>/<파일>(빈 파일)을 만든 임시 루트. */
export const featureRoot = (files: Record<string, string[]>): string => {
    const root = mkdtempSync(join(tmpdir(), "refresher-features-"));
    roots.push(root);
    for (const [folder, names] of Object.entries(files)) {
        mkdirSync(join(root, "features", folder), {recursive: true});
        for (const name of names) writeFileSync(join(root, "features", folder, name), "");
    }
    return root;
};

interface Manifest {
    commands?: Record<string, unknown>;
}

/** 모듈이 거는 훅만 받는 wxt. importEntrypoints는 파일 경로를 받아 imports로 넘긴다. */
export const fakeWxt = (root: string, imports: (files: string[]) => unknown[] = () => []) => {
    let manifestGenerated: ((wxt: Wxt, manifest: Manifest) => Promise<void> | void) | undefined;
    let prepareTypes: ((wxt: Wxt, entries: WxtDirEntry[]) => Promise<void> | void) | undefined;
    const importEntrypoints = vi.fn(async (files: string[]) => imports(files));
    const fake = {
        config: {root},
        builder: {importEntrypoints},
        hook: (name: string, handler: never) => {
            if (name === "build:manifestGenerated") manifestGenerated = handler;
            if (name === "prepare:types") prepareTypes = handler;
        }
    };
    // 모듈이 쓰는 것만 채운 가짜라 Wxt로 단언한다.
    const wxt = fake as unknown as Wxt;

    return {
        wxt,
        importEntrypoints,
        generateManifest: async (manifest: Manifest) => {
            await manifestGenerated?.(wxt, manifest);
            return manifest;
        },
        prepareTypes: async () => {
            const entries: WxtDirEntry[] = [];
            await prepareTypes?.(wxt, entries);
            return entries;
        }
    };
};

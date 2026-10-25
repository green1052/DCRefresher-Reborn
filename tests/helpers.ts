/** 단위 테스트 공용 도우미. 영역에만 필요한 도우미는 그 테스트 파일에 둔다. */
import {act as reactAct} from "react";
import {createRoot, type Root} from "react-dom/client";
import {flushSync} from "react-dom";
import type {ReactNode} from "react";
import {fakeBrowser} from "wxt/testing/fake-browser";

import type {AnyModule, ModuleDefinition, SettingSchema} from "@/core/module/types";
import type {ProcessedComment} from "@/core/preview/comments";
import type {GalleryPreData} from "@/core/preview/types";
import {DEFAULT_DETECT_MODE} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {emptyEntries, useBlocksStore} from "@/stores/blocks";

/** 걸린 타이머 0과 저장소 변경 알림이 한 차례 돌 때까지 기다린다. */
export const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

// 컨테이너마다 루트를 하나만 들고 다시 그린다 (같은 칸에 createRoot를 두 번 부르면 경고가 난다).
const roots = new WeakMap<HTMLElement, Root>();

/** preact의 render(엘리먼트, 컨테이너)와 같은 모양으로 동기에 그린다. null이면 뗀다. */
export const render = (element: ReactNode, container: HTMLElement): void => {
    if (element === null || element === undefined) {
        roots.get(container)?.unmount();
        roots.delete(container);
        return;
    }
    let root = roots.get(container);
    if (!root) {
        root = createRoot(container);
        roots.set(container, root);
    }
    // React는 root.render가 비동기라 바로 돌려주지 않는다. 테스트는 preact처럼 그린 직후 DOM을 읽는다.
    flushSync(() => root!.render(element));
};

/** React의 act. 짝수는 await하고 쓴다. */
export const act = reactAct as (callback: () => void | Promise<void>) => Promise<void>;

/** storage.local의 값 하나 (키는 local: 없이). */
export const stored = async (key: string): Promise<unknown> => (await fakeBrowser.storage.local.get(key))[key];

/** 설정 스키마 (리터럴을 SettingSchema로 넓힌다). */
export const setting = (schema: SettingSchema): SettingSchema => schema;

/** 레지스트리가 받는 모듈. */
export const testModule = <Api>({revoke, setup, ...definition}: ModuleDefinition<Record<string, SettingSchema>, Api> & { revoke?: () => void }): AnyModule =>
    ({
        ...definition,
        // revoke는 setup을 시작할 때 ctx.onRevoke로 등록한다 (모듈이 setup 맨 앞에서 등록하는 것과 같다).
        setup: (ctx) => {
            if (revoke) ctx.onRevoke(revoke);
            return setup(ctx);
        }
    }) as AnyModule;

/** 목록 행에서 읽은 글 정보. 주지 않은 필드는 test 갤러리 1번 글이다. */
export const preData = (fields: Partial<GalleryPreData> = {}): GalleryPreData =>
    ({gallery: "test", id: "1", link: "", notice: false, recommend: false, type: "icon_txt", commentCount: 0, ...fields});

/** 댓글 목록 API의 댓글. 주지 않은 필드는 유동 ㅇㅇ의 "댓글 {no}"다. 가공 필드(blocked 등)도 받는다. */
export const dcComment = (no: number, fields: Partial<ProcessedComment> = {}): ProcessedComment => ({
    no: String(no), c_no: "0", depth: 0, user_id: "", name: "ㅇㅇ", ip: "", memo: `댓글 ${no}`, is_delete: "0", date_time: "", ...fields
});

/** 차단 목록 항목. 주지 않으면 id는 내용이고 정규식이 아니다. */
export const blockEntry = (content: string, fields: Partial<BlockEntry> = {}): BlockEntry => ({id: content, content, isRegex: false, ...fields});

/** 차단 스토어에 목록·기본 모드를 저장소를 거치지 않고 넣는다. 주지 않은 유형은 비고, 기본 모드는 기본값이다. */
export const setBlockLists = (lists: Partial<Record<BlockType, BlockEntry[]>> = {}, defaults: Partial<Record<BlockType, DetectMode>> = {}): void =>
    useBlocksStore.setState({entries: {...emptyEntries(), ...lists}, defaults: {...DEFAULT_DETECT_MODE, ...defaults}});

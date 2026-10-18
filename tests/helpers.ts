/** 단위 테스트 공용 도우미. 영역에만 필요한 도우미는 그 테스트 파일에 둔다. */
import {fakeBrowser} from "wxt/testing/fake-browser";

import type {AnyModule, ModuleDefinition, SettingSchema} from "@/core/module/types";
import type {ProcessedComment} from "@/core/preview/comments";
import type {GalleryPreData} from "@/core/preview/types";
import {DEFAULT_DETECT_MODE} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {emptyEntries, useBlocksStore} from "@/stores/blocks";

/** 걸린 타이머 0과 저장소 변경 알림이 한 차례 돌 때까지 기다린다. */
export const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** storage.local의 값 하나 (키는 local: 없이). */
export const stored = async (key: string): Promise<unknown> => (await fakeBrowser.storage.local.get(key))[key];

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** 이름·설명을 비운 설정 스키마. */
export const setting = (schema: DistributiveOmit<SettingSchema, "name" | "desc">): SettingSchema => ({name: "", desc: "", ...schema} as SettingSchema);

/** 레지스트리가 받는 모듈. 이름·설명은 채운다. */
export const testModule = <Api>(definition: Omit<ModuleDefinition<Record<string, SettingSchema>, Api>, "name" | "description">): AnyModule =>
    ({name: "", description: "", ...definition}) as AnyModule;

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

/**
 * 단위 테스트 공통 도우미. 테스트 파일에서 `../../helpers`처럼 상대 경로로 불러온다
 */
import {fakeBrowser} from "wxt/testing/fake-browser";

import type {AnyModule, ModuleDefinition, SettingSchema} from "@/core/module/types";
import {DEFAULT_DETECT_MODE} from "@/core/storage/items";
import type {BlockEntry, BlockType, DetectMode} from "@/core/storage/types";
import {emptyEntries, useBlocksStore} from "@/stores/blocks";

/** 대기 중인 타이머와 저장소 변경 알림(storage.onChanged)이 한 차례 돌 때까지 기다린다 */
export const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** fake-browser storage.local의 값 하나. 키는 local: 없이 쓴다 */
export const stored = async (key: string): Promise<unknown> => (await fakeBrowser.storage.local.get(key))[key];

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** 테스트용 설정 스키마. 이름·설명은 비운다 */
export const setting = (schema: DistributiveOmit<SettingSchema, "name" | "desc">): SettingSchema => ({name: "", desc: "", ...schema} as SettingSchema);

/** 테스트용 모듈. 이름·설명은 비우고, 레지스트리가 받는 AnyModule로 돌려준다 */
export const testModule = <Api>(definition: Omit<ModuleDefinition<Record<string, SettingSchema>, Api>, "name" | "description">): AnyModule =>
    ({name: "", description: "", ...definition}) as AnyModule;

/** 차단 스토어에 목록과 기본 모드를 직접 넣는다 (저장소를 거치지 않는다). 주지 않은 유형은 비우고 기본 모드는 기본값이다 */
export const setBlockLists = (lists: Partial<Record<BlockType, BlockEntry[]>> = {}, defaults: Partial<Record<BlockType, DetectMode>> = {}): void =>
    useBlocksStore.setState({entries: {...emptyEntries(), ...lists}, defaults: {...DEFAULT_DETECT_MODE, ...defaults}});

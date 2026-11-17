// 유저 버블의 "차단" 처리. 차단 모듈이 꺼져 있어도 차단 목록(stores/blocks.ts)에는 넣으므로 모듈이 아닌 stores에 둔다.
import {runningModuleSettings} from "@/core/module/registry";
import {getDcconPackage} from "@/core/preview/request";
import {TYPE_NAMES} from "@/core/storage/items";
import type {BlockType} from "@/core/storage/types";
import {useBlocksStore} from "@/stores/blocks";
import {reportFailure} from "@/stores/notify";
import {type SelectedUser, useUiStore} from "@/stores/ui";

/** 패키지 전체 차단 방식. bundle: 정규식 한 항목으로 묶는다, each: 디시콘마다 한 항목 (따로 풀 수 있다). */
type DcconPackageMode = "bundle" | "each";

// 묶음 차단 정규식. 디시콘 경로는 공통 접두사(패키지 번호)가 길어 DcconRain의 PACKS처럼 접두사를 한 번만 쓴다.
const esc = (path: string) => (/^[0-9a-f]+$/.test(path) ? path : RegExp.escape(path));
const bundledPattern = (paths: string[]): string => {
    const unique = [...new Set(paths)];
    if (unique.length === 1) return `^(${esc(unique[0]!)})$`;
    let end = unique[0]!.length;
    for (const path of unique) {
        let i = 0;
        while (i < end && i < path.length && path[i] === unique[0]![i]) i++;
        end = i;
    }
    return `^(?:${esc(unique[0]!.slice(0, end))}(?:${unique.map((path) => esc(path.slice(end))).join("|")}))$`;
};

/**
 * 버블의 차단은 그 값을 막는다. 유형의 기본 모드가 NOT_*(허용 목록)면 모드 없이 넣은 항목이 허용 목록에 들어가므로 일치로 넣는다.
 * 포함(CONTAIN) 기본값은 사용자가 고른 것이라 그대로 따른다.
 */
// core/block.ts에 "가림 방식" 뜻의 blockMode가 있어 이름을 다르게 한다.
const defaultDetectMode = (type: BlockType) => (useBlocksStore.getState().defaults[type].startsWith("NOT_") ? "SAME" : undefined);

/** 유저 차단. uid > ip > nick 순으로 있는 값 하나를 쓴다. gallery가 있으면 그 갤러리에서만 막는다. */
const blockUser = async (selected: SelectedUser, gallery?: string): Promise<void> => {
    // 유동은 작성자 칸에 data-uid=""가 붙어 오므로 ??로는 ip로 넘어가지 않는다.
    const value = selected.uid || selected.ip || selected.nick;
    if (!value) return;

    const type: BlockType = selected.uid ? "ID" : selected.ip ? "IP" : "NICK";
    await useBlocksStore.getState().addEntry(type, {content: value, isRegex: false, extra: selected.nick || value, mode: defaultDetectMode(type), gallery});

    // 유저 정보 모듈만 켜져 있어도 버블이 열린다. 목록에는 넣었지만 가리지는 않는다는 것을 알린다.
    const off = runningModuleSettings("block") === undefined ? " 콘텐츠 차단 모듈이 꺼져 있어 지금은 가리지 않습니다." : "";
    const scope = gallery ? ", 이 갤러리만" : "";
    useUiStore.getState().showToast(`차단 목록에 추가했습니다. (${TYPE_NAMES[type]}: ${value}${scope})${off}`);
};

const blockDccon = async (selected: SelectedUser, dcconPackage?: DcconPackageMode): Promise<void> => {
    const code = selected.dccon;
    if (!code) return;

    const response = await getDcconPackage(code);

    const extra = `${response.info.title} [${response.info.package_idx}]`;
    const mode = defaultDetectMode("DCCON");

    if (!dcconPackage) {
        await useBlocksStore.getState().addEntry("DCCON", {content: code, isRegex: false, extra, mode});
    } else if (dcconPackage === "bundle") {
        await useBlocksStore.getState().addEntry("DCCON", {content: bundledPattern(response.detail.map((detail) => detail.path)), isRegex: true, extra: `[묶음] ${extra}`, mode});
    } else {
        // 묶지 않고 하나씩 넣되 addEntries로 한 번에 쓴다. 따로 넣으면 저장소 쓰기와 모든 탭의 watch가 디시콘 수만큼 돈다.
        await useBlocksStore.getState().addEntries("DCCON", response.detail.map(({path}) => ({content: path, isRegex: false, extra, mode})));
    }

    useUiStore.getState().showToast(`디시콘을 차단했습니다. (${extra})`);
};

export type BlockRequestOptions = {
    target: "user" | "dccon";
    /** 디시콘이 든 패키지 전체를 차단한다. 없으면 그 디시콘 하나만. */
    dcconPackage?: DcconPackageMode;
    /** 유저 차단을 이 갤러리 id에서만 건다. 없으면 모든 갤러리. */
    gallery?: string;
};

export const handleBlockRequest = async (options: BlockRequestOptions, selected: SelectedUser): Promise<void> => {
    try {
        if (options.target === "dccon") await blockDccon(selected, options.dcconPackage);
        else await blockUser(selected, options.gallery);
    } catch (e) {
        reportFailure(e, "Block request failed:", options.target === "dccon" ? "디시콘을 차단하지 못했습니다." : "차단 목록에 저장하지 못했습니다.");
    }
};

// 유저 버블의 "차단" 처리. 차단 모듈이 꺼져 있어도 차단 목록(stores/blocks.ts)에는 넣으므로 모듈이 아닌 stores에 둔다.
import {imageHash} from "@/core/block";
import {BlockedError} from "@/core/http/client";
import {runningModuleSettings} from "@/core/module/registry";
import {fetchDcconPackage} from "@/core/preview/request";
import {TYPE_NAMES} from "@/core/storage/items";
import type {BlockType} from "@/core/storage/types";
import {useBlocksStore} from "@/stores/blocks";
import {type SelectedUser, useUiStore} from "@/stores/ui";

/** 패키지 전체 차단 방식. bundle: 정규식 한 항목으로 묶는다, each: 디시콘마다 한 항목 (따로 풀 수 있다). */
type DcconPackageMode = "bundle" | "each";

/**
 * 버블의 차단은 그 값을 막는 것이다. 유형의 기본 모드가 NOT_*(허용 목록)면 모드 없이 넣은 항목이 허용 목록에 들어가므로 일치로 넣는다.
 * 포함(CONTAIN) 기본값은 사용자가 고른 것이라 그대로 따른다.
 */
const blockMode = (type: BlockType) => (useBlocksStore.getState().defaults[type].startsWith("NOT_") ? "SAME" : undefined);

/** 유저 차단. uid > ip > nick 순으로 있는 값 하나를 쓴다. gallery가 있으면 그 갤러리에서만 막는다. */
const blockUser = async (selected: SelectedUser, gallery?: string): Promise<void> => {
    // 유동은 작성자 칸에 data-uid=""가 붙어 오므로 ??로는 ip로 넘어가지 않는다.
    const value = selected.uid || selected.ip || selected.nick;
    if (!value) return;

    const type: BlockType = selected.uid ? "ID" : selected.ip ? "IP" : "NICK";
    await useBlocksStore.getState().addEntry(type, {content: value, isRegex: false, extra: selected.nick || value, mode: blockMode(type), gallery});

    // 유저 정보 모듈만 켜져 있어도 버블이 열린다. 목록에는 넣었지만 가리지는 않는다는 것을 알린다.
    const off = runningModuleSettings("block") === undefined ? " 콘텐츠 차단 모듈이 꺼져 있어 지금은 가리지 않습니다." : "";
    const scope = gallery ? ", 이 갤러리만" : "";
    useUiStore.getState().showToast(`차단 목록에 추가했습니다. (${TYPE_NAMES[type]}: ${value}${scope})${off}`);
};

const blockDccon = async (selected: SelectedUser, dcconPackage?: DcconPackageMode): Promise<void> => {
    const code = selected.dccon;
    if (!code) return;

    const response = await fetchDcconPackage(code);

    const extra = `${response.info.title} [${response.info.package_idx}]`;
    const mode = blockMode("DCCON");

    if (!dcconPackage) {
        await useBlocksStore.getState().addEntry("DCCON", {content: code, isRegex: false, extra, mode});
    } else if (dcconPackage === "bundle") {
        // 경로에 정규식 특수문자가 있으면 의미가 변하므로 묶을 때 이스케이프한다.
        const paths = response.detail.map((detail) => RegExp.escape(detail.path)).join("|");
        await useBlocksStore.getState().addEntry("DCCON", {content: `^(${paths})$`, isRegex: true, extra: `[묶음] ${extra}`, mode});
    } else {
        // 묶지 않고 하나씩 넣되 addEntries로 한 번에 쓴다. 따로 넣으면 저장소 쓰기와 모든 탭의 watch가 디시콘 수만큼 돈다.
        await useBlocksStore.getState().addEntries("DCCON", response.detail.map(({path}) => ({content: path, isRegex: false, extra, mode})));
    }

    useUiStore.getState().showToast(`디시콘을 차단했습니다. (${extra})`);
};

/** 이미지 우클릭 메뉴의 "이 이미지 차단" (features/block/background.ts). 같은 파일이면 다른 글에 다시 올려도 가린다. */
export const blockImage = async (url: string): Promise<void> => {
    // 메뉴가 방금 권한을 받았으면 그전에 읽지 못한 것이 남아 있다.
    const hash = await imageHash(url, {retry: true});
    if (!hash) {
        useUiStore.getState().showToast("이미지를 읽지 못해 차단하지 못했습니다.", "error");
        return;
    }
    try {
        await useBlocksStore.getState().addEntry("IMAGE", {content: hash, isRegex: false, mode: blockMode("IMAGE")});
    } catch (e) {
        console.error("Image block failed:", e);
        useUiStore.getState().showToast("차단 목록에 저장하지 못했습니다.", "error");
        return;
    }
    useUiStore.getState().showToast("이미지를 차단했습니다.");
};

export type BlockRequestOptions = {
    target: "user" | "dccon";
    /** 디시콘이 든 패키지 전체를 차단한다. 없으면 그 디시콘 하나만. */
    dcconPackage?: DcconPackageMode;
    /** 유저 차단을 이 갤러리 id에서만 건다. 없으면 모든 갤러리. */
    gallery?: string;
};

/** 유저 버블의 차단 요청을 처리한다. */
export const handleBlockRequest = async (options: BlockRequestOptions, selected: SelectedUser): Promise<void> => {
    try {
        if (options.target === "dccon") await blockDccon(selected, options.dcconPackage);
        else await blockUser(selected, options.gallery);
    } catch (e) {
        console.error("Block request failed:", e);
        // 임시 차단은 HTTP 클라이언트가 이미 알렸다.
        if (e instanceof BlockedError) return;
        useUiStore.getState().showToast(options.target === "dccon" ? "디시콘을 차단하지 못했습니다." : "차단 목록에 저장하지 못했습니다.", "error");
    }
};

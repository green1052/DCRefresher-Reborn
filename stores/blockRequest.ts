// 유저 버블의 "차단" 처리. 차단 모듈이 꺼져 있어도 차단 목록(stores/blocks)에는 넣으므로 모듈이 아닌 stores에 둔다.
import {BlockedError} from "@/core/http/client";
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

/** 유저 차단. uid > ip > nick 순으로 있는 값 하나를 쓴다. */
const blockUser = async (selected: SelectedUser): Promise<void> => {
    // 유동은 작성자 칸에 data-uid=""가 붙어 오므로 ??로는 ip로 넘어가지 않는다.
    const value = selected.uid || selected.ip || selected.nick;
    if (!value) return;

    const type: BlockType = selected.uid ? "ID" : selected.ip ? "IP" : "NICK";
    await useBlocksStore.getState().addEntry(type, {content: value, isRegex: false, extra: selected.nick || value, mode: blockMode(type)});

    // 유저 정보 모듈만 켜져 있어도 버블이 열린다. 목록에는 넣었지만 가리지는 않는다는 것을 알린다.
    const off = useUiStore.getState().blockView === null ? " 콘텐츠 차단 모듈이 꺼져 있어 지금은 가리지 않습니다." : "";
    useUiStore.getState().showToast(`차단 목록에 추가했습니다. (${TYPE_NAMES[type]}: ${value})${off}`);
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

export type BlockRequestOptions = {
    target: "user" | "dccon";
    /** 디시콘이 든 패키지 전체를 차단한다. 없으면 그 디시콘 하나만. */
    dcconPackage?: DcconPackageMode;
};

/** 유저 버블의 차단 요청을 처리한다. 차단 모듈이 꺼져 있어도 목록에는 넣는다. */
export const handleBlockRequest = async (options: BlockRequestOptions, selected: SelectedUser): Promise<void> => {
    try {
        if (options.target === "dccon") await blockDccon(selected, options.dcconPackage);
        else await blockUser(selected);
    } catch (e) {
        console.error("Block request failed:", e);
        // 임시 차단은 HTTP 클라이언트가 이미 알렸다. 디시콘은 정보 받기와 저장 중 어느 쪽이 실패했어도 같은 문구다.
        if (e instanceof BlockedError) return;
        useUiStore.getState().showToast(options.target === "dccon" ? "디시콘을 차단하지 못했습니다." : "차단 목록에 저장하지 못했습니다.", "error");
    }
};

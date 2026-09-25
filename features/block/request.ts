import type {BlockRequestOptions} from "@/core/eventbus/types";
import {useBlocksStore} from "@/stores/blocks";
import {http} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import type {BlockType, DetectMode} from "@/core/storage/types";
import {getCookie} from "@/utils/cookie";
import {type SelectedUser, useUiStore} from "@/stores/ui";

interface DcconDetailResponse {
    info: {
        title: string;
        package_idx: number | string;
    };
    detail: {
        path: string;
    }[];
}


/** 유저 차단: uid > ip > nick 우선순위 */
const blockUser = async (selected: SelectedUser): Promise<void> => {
    const value = selected.uid ?? selected.ip ?? selected.nick;
    if (!value) return;

    const type: BlockType = selected.uid ? "ID" : selected.ip ? "IP" : "NICK";
    await useBlocksStore.getState().addEntry(type, {content: value, isRegex: false, extra: selected.nick ?? value});

    useUiStore.getState().showToast(`차단 목록에 추가했습니다. (${type}: ${value})`);
};

const blockDccon = async (selected: SelectedUser, blockAllDccon?: boolean): Promise<void> => {
    const code = selected.dccon;
    if (!code) return;

    const response = await http.post(urls.dccon.detail, {
        headers: {"X-Requested-With": "XMLHttpRequest"},
        body: new URLSearchParams({ci_t: (await getCookie("ci_c")) ?? "", code})
    }).json<DcconDetailResponse>();

    const extra = `${response.info.title} [${response.info.package_idx}]`;

    if (blockAllDccon) {
        if (!confirm("디시콘을 묶어서 차단하시겠습니까?")) {
            // 묶음 대신 각각 추가
            for (const detail of response.detail) {
                await useBlocksStore.getState().addEntry("DCCON", {content: detail.path, isRegex: false, extra});
            }
            return;
        }

        const paths = response.detail.map((detail) => detail.path).join("|");
        await useBlocksStore.getState().addEntry("DCCON", {content: `^(${paths})$`, isRegex: true, extra: `[묶음] ${extra}`});
        return;
    }

    await useBlocksStore.getState().addEntry("DCCON", {content: code, isRegex: false, extra});
};

/** eventBus "refresherRequestBlock" 처리. 마지막 선택은 10초까지 유효 */
export const handleBlockRequest = async (options: BlockRequestOptions, selected: SelectedUser | null): Promise<void> => {
    if (!selected || Date.now() - selected.at > 10_000) {
        useUiStore.getState().showToast("차단할 대상을 다시 오른쪽 클릭해주세요.");
        return;
    }

    try {
        if (options.target === "dccon") await blockDccon(selected, options.blockAllDccon);
        else await blockUser(selected);
    } catch (error) {
        console.error("Block request failed:", error);
        useUiStore.getState().showToast("차단 처리 중 오류가 발생했습니다.", "error");
    }
};

/** 차단 다이얼로그/컨텍스트에서 만들 extra ([정규식] [갤러리: X] [모드명] 순) */
export const composeExtra = (fields: {
    isRegex: boolean;
    gallery?: string;
    mode?: DetectMode
}, modeNames: Record<DetectMode, string>): string =>
    [
        fields.isRegex ? "[정규식]" : "",
        fields.gallery ? `[갤러리: ${fields.gallery}]` : "",
        fields.mode ? `[${modeNames[fields.mode]}]` : ""
    ]
        .filter(Boolean)
        .join(" ");

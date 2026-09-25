import type {BlockRequestOptions} from "@/core/eventbus/types";
import {useBlocksStore} from "@/stores/blocks";
import {ajax} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import type {BlockType, DetectMode} from "@/core/storage/types";
import {csrfToken} from "@/utils/cookie";
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
    // 유동은 작성자 칸에 data-uid=""가 붙어 오므로 ??로는 ip로 넘어가지 않는다
    const value = selected.uid || selected.ip || selected.nick;
    if (!value) return;

    const type: BlockType = selected.uid ? "ID" : selected.ip ? "IP" : "NICK";
    await useBlocksStore.getState().addEntry(type, {content: value, isRegex: false, extra: selected.nick || value});

    useUiStore.getState().showToast(`차단 목록에 추가했습니다. (${type}: ${value})`);
};

const blockDccon = async (selected: SelectedUser, blockAllDccon?: boolean): Promise<void> => {
    const code = selected.dccon;
    if (!code) return;

    const response = await ajax.post(urls.dccon.detail, {
        body: new URLSearchParams({ci_t: await csrfToken(), code})
    }).json<DcconDetailResponse>();

    const extra = `${response.info.title} [${response.info.package_idx}]`;

    if (!blockAllDccon) {
        await useBlocksStore.getState().addEntry("DCCON", {content: code, isRegex: false, extra});
    } else if (confirm("디시콘을 묶어서 차단하시겠습니까?")) {
        const paths = response.detail.map((detail) => detail.path).join("|");
        await useBlocksStore.getState().addEntry("DCCON", {content: `^(${paths})$`, isRegex: true, extra: `[묶음] ${extra}`});
    } else {
        // 묶음 대신 각각 추가 — addEntry를 디시콘 수만큼 부르면 저장소 쓰기와 모든 탭의 watch도 그만큼 돈다.
        // 걸러내는 기준은 stores/blocks의 dedupe와 같다 (갤러리 없는 같은 content는 교체)
        const paths = new Set(response.detail.map((detail) => detail.path));
        const {entries, setEntries} = useBlocksStore.getState();
        await setEntries("DCCON", [
            ...entries.DCCON.filter((entry) => entry.gallery || !paths.has(entry.content)),
            ...[...paths].map((content) => ({id: crypto.randomUUID(), content, isRegex: false, extra}))
        ]);
    }

    useUiStore.getState().showToast(`디시콘을 차단했습니다. (${extra})`);
};

/** eventBus "refresherRequestBlock" 처리 */
export const handleBlockRequest = async (options: BlockRequestOptions, selected: SelectedUser | null): Promise<void> => {
    if (!selected) {
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

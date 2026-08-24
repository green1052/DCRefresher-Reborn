import http, {ajaxClient} from "@/http/http";

import block from "@/core/block";
import toast from "@/utils/toast";

interface DcconDetailResponse {
    info?: {
        title: string;
        package_idx: string;
    };
    detail: Array<{ path: string }>;
}

export interface BlockSelected {
    nick: string | null;
    uid: string | null;
    ip: string | null;
    code: string | null;
    packageIdx: string | null;
}

export const handleBlockRequest = async (
    args: BlockRequestOptions,
    selected: BlockSelected,
    lastSelectAge: number
): Promise<void> => {
    if (lastSelectAge > 10000) {
        toast.show("차단할 대상을 다시 오른쪽 클릭해주세요.", "error");
        return;
    }

    const code = selected.code;

    if (args.target === "dccon") {
        if (!code) {
            toast.show("차단할 디시콘을 다시 오른쪽 클릭해주세요.", "error");
            return;
        }

        const params = http.createAuthParams();
        params.set("code", code);

        try {
            const json = await ajaxClient(http.urls.dccon.detail, {
                body: params
            }).json<DcconDetailResponse>();

            if (!json?.info) {
                throw new Error("디시콘 상세 정보가 없습니다.");
            }

            const title = json.info.title;
            const packageIdx = json.info.package_idx;

            if (args.blockAllDccon) {
                const blockBundle = confirm(
                    "디시콘을 묶어서 차단하시겠습니까? (차단 목록에서는 한개로 표시됩니다.)"
                );

                if (blockBundle) {
                    const paths = json.detail.map(({path}) => RegExp.escape(path));
                    await block.add(
                        "DCCON",
                        `^(${paths.join("|")})$`,
                        true,
                        undefined,
                        `[묶음] ${title} [${packageIdx}]`
                    );
                } else {
                    for (const {path} of json.detail) {
                        await block.add(
                            "DCCON",
                            path,
                            false,
                            undefined,
                            `${title} [${packageIdx}]`
                        );
                    }
                }

                toast.show(`${title} ${block.TYPE_NAMES.DCCON} 묶음을 차단했습니다.`);
                return;
            }

            await block.add("DCCON", code, false, undefined, `${title} [${packageIdx}]`);
            toast.show(`${title} ${block.TYPE_NAMES.DCCON}을 차단했습니다.`);
        } catch (error) {
            console.error("Failed to block dccon:", error);
            toast.show("디시콘 정보를 가져오거나 저장하는데 실패했습니다.", "error");
        }

        return;
    }

    let type: RefresherBlockType = "NICK";
    let value = selected.nick;

    if (selected.uid) {
        type = "ID";
        value = selected.uid;
    } else if (selected.ip) {
        type = "IP";
        value = selected.ip;
    }

    if (!value) {
        toast.show("차단할 유저를 다시 오른쪽 클릭해주세요.", "error");
        return;
    }

    try {
        await block.add(type, value, false, undefined, selected.nick ?? value);
        toast.show(`${block.TYPE_NAMES[type]} ${value}을(를) 차단했습니다.`);
    } catch (error) {
        console.error("Failed to save blocked user:", error);
        toast.show("차단 목록을 저장하는데 실패했습니다.", "error");
    }
};
import {groupDuplicates, isAnyBlocked, isBlocked} from "@/core/block";
import {htmlToText, sanitizeHtml} from "@/utils/sanitize";
import type {ModuleContext} from "@/core/module/types";
import {useUiStore} from "@/stores/ui";

import {restoreArchive} from "./cache";
import type {DcinsideComment, GalleryPreData} from "./types";

export interface ProcessedComment extends DcinsideComment {
    /** 음성댓글 — vr_player. iframe이면 경로가 아니라 플레이어 페이지라 <audio>로 못 튼다 */
    voice?: { src: string; iframe: boolean };
    /** 차단 모듈에 걸림 — 모듈 설정대로 흐리게(blur) 또는 숨긴다(hide) */
    blocked?: "blur" | "hide";
    /** 같은 댓글 — 첫 댓글은 반복 수, 나머지는 0 (접힘) */
    duplicates?: number;
}

const GALLOG_DCCON = /dcimg5\.dcinside\.com\/dccon\.php\?no=(\w*)/g;

/** 디시콘 2개짜리 댓글은 태그가 `…"img class="written_dccon`처럼 `><` 없이 붙어 온다 — 정화하면 두 번째가 속성으로 먹히므로 먼저 떼어 놓는다 */
const splitDccons = (memo: string): string => memo.replace(/"\s*(img|video) class="written_dccon/g, "\"><$1 class=\"written_dccon");

const cleanMemo = (memo: string): string =>
    sanitizeHtml(splitDccons(memo).replace(/data-dcconoverstatus="?\w+"?/g, "data-dcconoverstatus=\"true\""));

const extractVoice = (memo: string): { memo: string; voice?: ProcessedComment["voice"] } | undefined => {
    if (!memo.includes("@^dc^@")) return;

    // 앞이 음성 경로(또는 iframe), 뒤가 글 — 원본·v5와 같은 순서
    const [raw = "", display = ""] = memo.split("@^dc^@");
    const iframe = raw.includes("<iframe");
    const src = iframe ? (raw.match(/src="([^"]+)"/)?.[1] ?? "") : `https://vr.dcinside.com/${raw}`;

    // 음성댓글 호스트만 허용 — 임의 iframe 차단. 음성만 버리고 글은 살린다 (memo째 넘기면 구분자와 iframe 태그가 그대로 그려진다)
    if (!src.startsWith("https://vr.dcinside.com/")) return {memo: display};

    return {memo: display, voice: {src, iframe}};
};

/** 댓글 정리→사용자→차단→아카이브 처리 */
export const processComments = (
    raw: DcinsideComment[],
    preData: GalleryPreData,
    ctx: ModuleContext
): { list: ProcessedComment[]; threads: number; totalCnt: number; blocked: number; folded: number } => {
    // 댓글돌이(COMMENT_BOY) 제거 — 보존(restoreArchive)의 번호순 정렬보다 먼저 거른다
    const filtered = raw.filter((comment) => String(comment.nicktype) !== "COMMENT_BOY");

    // 캐시된 원본을 보호하기 위해 복사본에서 가공
    const source = ctx.settings.archiveArticle === true ? restoreArchive(preData, filtered) : filtered;
    const list: ProcessedComment[] = source.map((comment) => ({...comment}));

    // 음성 분리 후 정제 — 음성 URL은 정제(재직렬화)하면 &가 &amp;로 바뀌므로 먼저 떼어낸다
    for (const comment of list) {
        const voice = extractVoice(String(comment.memo ?? ""));
        if (voice) comment.voice = voice.voice;
        comment.memo = cleanMemo(voice?.memo ?? String(comment.memo ?? ""));
    }

    // 차단은 차단 모듈 설정을 따른다 — 모듈이 꺼져 있으면 가리지 않는다. 가리는 방법은 그릴 때 정한다 (Comment.tsx)
    const view = useUiStore.getState().blockView;
    const texts = new Map(list.map((comment) => [comment, htmlToText(comment.memo)]));

    for (const comment of view ? list : []) {
        // 삭제 표시된 댓글도 검사한다 — 보존으로 되살린 댓글은 원문이라 건너뛰면 차단된 내용이 보인다
        const plain = texts.get(comment);
        // 디시콘 2개짜리 댓글은 두 번째도 검사한다
        const dcconNos = Array.from(comment.memo.matchAll(GALLOG_DCCON), (match) => match[1] ?? "");

        const blocked =
            isAnyBlocked(
                {
                    NICK: comment.name || null,
                    ID: comment.user_id || null,
                    IP: comment.ip || null,
                    COMMENT: plain || null
                },
                preData.gallery
            ) || dcconNos.some((no) => isBlocked("DCCON", no, preData.gallery));

        if (blocked) comment.blocked = view!.blur ? "blur" : "hide";
    }

    if (view?.replyRemove) {
        // 답글의 c_no는 쓰레드 첫 댓글 번호
        const blockedThreads = new Set(list.filter((comment) => comment.depth === 0 && comment.blocked).map((comment) => comment.no));
        for (const comment of list) if (comment.depth === 1 && blockedThreads.has(comment.c_no)) comment.blocked ??= view.blur ? "blur" : "hide";
    }

    if (view?.duplicate) {
        const candidates = list.filter((comment) => !comment.blocked && comment.is_delete !== "1");
        for (const [comment, repeats] of groupDuplicates(candidates, (comment) => texts.get(comment) ?? "", view.duplicate)) comment.duplicates = repeats;
    }

    const threads = list.filter((comment) => comment.depth === 0).length;

    return {
        list,
        threads,
        totalCnt: list.length,
        blocked: list.filter((comment) => comment.blocked).length,
        folded: list.filter((comment) => comment.duplicates === 0).length
    };
};


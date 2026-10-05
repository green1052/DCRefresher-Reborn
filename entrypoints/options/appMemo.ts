import type {MemoEntry, MemoType} from "@/core/storage/types";

/** 공앱(디시인사이드 모바일 앱) 메모 한 줄: "아이디-메모". 아이디 자리가 앞 두 자리 IP(123.45)면 IP 메모다. */
const APP_IP = /^\d{1,3}\.\d{1,3}$/;

type AppMemos = Record<"UID" | "IP", Record<string, string>>;

/** 공앱 메모 글 → 대상별 메모 글. 형식이 아닌 줄(빈 줄, "-"가 없거나 대상·메모가 빈 줄)은 세어 돌려준다. */
export const parseAppMemos = (text: string): { memos: AppMemos; skipped: number } => {
    const memos: AppMemos = {UID: {}, IP: {}};
    let skipped = 0;

    for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        // 메모에 "-"가 들어 있을 수 있어 첫 "-"에서만 나눈다 (디시 아이디에는 "-"가 없다).
        const at = line.indexOf("-");
        const target = at < 0 ? "" : line.slice(0, at).trim();
        const memo = at < 0 ? "" : line.slice(at + 1).trim();
        if (!target || !memo) {
            skipped++;
            continue;
        }
        memos[APP_IP.test(target) ? "IP" : "UID"][target] = memo;
    }

    return {memos, skipped};
};

/** 리프레셔 메모 → 공앱 메모 글. 공앱은 아이디·IP 메모만 있어 닉네임 메모는 빼고 그 개수를 돌려준다. */
export const formatAppMemos = (memos: Record<MemoType, Record<string, MemoEntry>>): { text: string; count: number; skipped: number } => {
    const lines = (["UID", "IP"] as const).flatMap((type) =>
        // 공앱은 한 줄에 메모 하나라 줄바꿈은 공백으로 바꾼다.
        Object.entries(memos[type]).map(([target, entry]) => `${target}-${entry.text.replace(/\s*\n\s*/g, " ")}`));
    return {text: lines.join("\n"), count: lines.length, skipped: Object.keys(memos.NICK).length};
};

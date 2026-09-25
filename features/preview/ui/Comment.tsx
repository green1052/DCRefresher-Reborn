import {Box, Flex, IconButton, Text, Tooltip} from "@radix-ui/themes";
import {Check, ChevronDown, Reply as ReplyIcon, X} from "lucide-react";
import {type MouseEvent, useEffect, useLayoutEffect, useRef, useState} from "react";

import {overlay} from "@/components/overlay/shadow";
import type {ProcessedComment} from "@/core/preview/comments";
import type {User} from "@/core/preview/types";
import {adminDeleteComment, graphemes, TXTCON_MAX_LINE_LEN, userDeleteComment} from "@/core/preview/request";
import {notifyManage} from "@/utils/notify";
import {useUserMemo} from "@/stores/memos";
import {useUiStore} from "@/stores/ui";
import {useGallogActivity} from "@/utils/gallogActivity";
import {banReasonsOf, ipInfoOf} from "@/core/database";
import {isGalleryManager} from "@/utils/user";

import {usePreviewStore} from "./previewStore";

const parseDate = (value: string): Date => {
    const missingYear = value.substring(0, 4).match(/\./);

    return new Date((missingYear ? `${new Date().getFullYear()}-` : "") + value.replace(/\./g, "-"));
};

const relative = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    if (Number.isNaN(diff) || diff < 0) return date.toLocaleString();
    if (diff < 3000) return "방금 전";

    const units: [string, number][] = [
        ["년", 31_536_000_000],
        ["주", 604_800_000],
        ["일", 86_400_000],
        ["시간", 3_600_000],
        ["분", 60_000],
        ["초", 1000]
    ];

    for (const [label, ms] of units) {
        if (diff >= ms) return `${Math.floor(diff / ms)}${label} 전`;
    }

    return date.toLocaleString();
};

const extractIcon = (html: string | undefined): string | undefined =>
    new DOMParser().parseFromString(html ?? "", "text/html").querySelector("a.writer_nikcon img")?.getAttribute("src") ?? undefined;

const extractIp = (html: string | undefined): string | undefined => html?.match(/class=["']?ip["']?[^>]*>\s*\(([^)]+)\)/)?.[1];

/* ===== 글자콘 — 디시 txtcon_view.js를 옮김 (디시 스크립트는 shadow DOM에 닿지 않는다) ===== */

/** 직접 줄바꿈은 두고 각 줄을 5글자씩 나눈다 */
const wrapTxtcon = (text: string): string =>
    text
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => graphemes(line).map((char, i) => (i && i % TXTCON_MAX_LINE_LEN === 0 ? "\n" : "") + char).join(""))
        .join("\n");

/** 박스에 넘치지 않는 최대 글자 크기 (16~72px 이진 탐색). 줄 수는 16px 기준으로 고정, 폭이 넘치면 break-all */
const fitTxtcon = (box: HTMLElement): void => {
    const txt = box.querySelector<HTMLElement>(".txtcon_txt");
    if (!txt || !box.getClientRects().length) return;

    Object.assign(txt.style, {wordBreak: "keep-all", overflowWrap: "normal", whiteSpace: "pre-line", letterSpacing: "", transform: ""});

    // 크기를 재는 인라인 span — 다시 불려도 이미 나눈 줄은 그대로다
    const meas = document.createElement("span");
    meas.textContent = wrapTxtcon(Array.from(txt.childNodes, (node) => (node.nodeName === "BR" ? "\n" : node.textContent)).join(""));
    txt.replaceChildren(meas);

    const style = getComputedStyle(box);
    const availW = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availH = box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const tol = 0.5 / devicePixelRatio;

    const fit = (floor: number, keepLines: boolean): void => {
        txt.style.fontSize = `${floor}px`;
        const baseLines = keepLines ? meas.getClientRects().length : Infinity;
        let min = floor, max = 72, best = floor;
        while (min <= max) {
            const mid = Math.floor((min + max) / 2);
            txt.style.fontSize = `${mid}px`;
            const rect = meas.getBoundingClientRect();
            if (rect.width <= availW + tol && rect.height <= availH + tol && meas.getClientRects().length <= baseLines) {
                best = mid;
                min = mid + 1;
            } else {
                max = mid - 1;
            }
        }
        txt.style.fontSize = `${best}px`;
    };

    fit(16, true);
    if (meas.getBoundingClientRect().width > availW + tol) {
        txt.style.wordBreak = "break-all";
        fit(16, true);
    }

    // 16px로도 크게 넘치면 더 줄여서 담는다 (줄 수 제한 없음)
    const over = meas.getBoundingClientRect();
    if (over.height - availH > 4 || over.width - availW > 4) fit(10, false);

    // 남는 폭을 자간으로 채운다 (마지막 글자 뒤 자간만큼 치우치므로 transform으로 보정)
    // 글자 수는 디시처럼 이스케이프된 채로 센다 (&는 &amp; 5글자) — 디시와 같은 자간이 나오게
    const longest = Math.max(...meas.innerHTML.split("\n").map((line) => graphemes(line).length));
    const slack = availW - meas.getBoundingClientRect().width;
    if (longest > 1 && slack > 1) {
        const spacing = slack / longest;
        txt.style.letterSpacing = `calc(-0.045em + ${spacing.toFixed(2)}px)`;
        txt.style.transform = `translate(${(spacing / 2).toFixed(2)}px, -0.05em)`;
    }
};

/** ms마다 다시 그린다 (탭이 숨겨져 있으면 건너뛴다) */
export const useTick = (ms: number): void => {
    const [, force] = useState(0);

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (!document.hidden) force((x) => x + 1);
        }, ms);
        return () => window.clearInterval(timer);
    }, [ms]);
};

const TimeStamp = ({date}: { date: string }) => {
    const parsed = parseDate(date);
    const [absolute, setAbsolute] = useState(false);
    // 댓글마다 타이머가 도니, 초 단위로 바뀌는 1분 미만일 때만 5초마다, 그 밖에는 1분마다 다시 그린다
    useTick(Date.now() - parsed.getTime() < 60_000 ? 5000 : 60_000);

    return (
        <Text size="1" color="gray" title={parsed.toLocaleString()} style={{cursor: "pointer", whiteSpace: "nowrap"}}
              onClick={() => setAbsolute((x) => !x)}>
            {Number.isNaN(parsed.getTime()) ? "이미 삭제됨" : absolute ? parsed.toLocaleString() : relative(parsed)}
        </Text>
    );
};

/** 작성자 표시. 우클릭하면 유저 버블 */
/** fetchRatio: 글댓비 캐시에 없으면 갤로그에서 받는다 (글쓴이만 — 댓글마다 받으면 요청이 너무 많다) */
export const UserCard = ({user, fetchRatio}: { user: User; fetchRatio?: boolean }) => {
    const ipInfo = user.ip ? ipInfoOf(user.ip) : undefined;
    const ipColor = useUiStore((state) => (ipInfo ? state.badgeColors[ipInfo.category] : undefined));
    const banReasons = user.id ? banReasonsOf(user.id) : undefined;
    const banColor = useUiStore((state) => state.badgeColors.permBan);
    const uidColor = useUiStore((state) => state.badgeColors.uid);
    const info = [user.id, user.ip].filter(Boolean).join(" / ");
    const gallery = usePreviewStore((s) => s.preData?.gallery);
    const memo = useUserMemo({uid: user.id, ip: user.ip, nick: user.nick}, gallery);
    const ratios = useUiStore((state) => state.ratios);
    const cached = user.id ? ratios?.cache[user.id] : undefined;
    const fetched = useGallogActivity(fetchRatio && ratios && !cached ? user.id : undefined);
    const ratio = cached ?? (typeof fetched === "object" ? fetched : undefined);
    const ratioColor = useUiStore((state) => (ratio && ratios && ratios.alarm > 0 && ratio.article + ratio.comment <= ratios.alarm ? state.badgeColors.ratioAlarm : state.badgeColors.ratio));

    const openMenu = (event: MouseEvent): void => {
        event.preventDefault();

        const ui = useUiStore.getState();
        ui.setSelected({nick: user.nick, uid: user.id, ip: user.ip});
        ui.openBubble(event.clientX, event.clientY);
    };

    return (
        <Flex align="center" gap="1" minWidth="0" onContextMenu={openMenu} style={{cursor: "context-menu"}}>
            <Text size="2" weight="bold" truncate>{user.nick ?? user.id ?? user.ip}</Text>
            {user.image && <img src={user.image} alt="" height={12}/>}
            {info && <Text size="1" color={uidColor ? undefined : "gray"} style={{color: uidColor}} truncate>({info})</Text>}
            {ipInfo && <Text size="1" color={ipColor ? undefined : "blue"} style={{color: ipColor}} title={ipInfo.title} truncate>[{ipInfo.label}]</Text>}
            {ratio && <Text size="1" style={{color: ratioColor}} title="글/댓글" truncate>[{ratio.article}/{ratio.comment}]</Text>}
            {banReasons && banColor && <Text size="1" style={{color: banColor}} title={banReasons} truncate>[{banReasons}]</Text>}
            {memo && <Text size="1" style={{color: memo.color || undefined}} title={memo.text} truncate>[{memo.text}]</Text>}
        </Flex>
    );
};

interface CommentProps {
    comment: ProcessedComment;
    depth: number;
    replyCount: number;
    /** 답글이 펼쳐진 부모 — 아래로 트리 선을 긋는다 */
    threadOpen?: boolean;
    /** 쓰레드의 마지막 답글 — 트리 선이 여기서 끝난다 */
    lastReply?: boolean;
}

export const Comment = ({comment, depth, replyCount, threadOpen, lastReply}: CommentProps) => {
    // reply 객체째 구독하면 답글 버튼 하나에 모든 댓글이 다시 그려진다 — 내 댓글인지만 본다
    const replying = usePreviewStore((s) => s.reply.replyNo === comment.no);
    const collapsed = usePreviewStore((s) => s.collapsed.has(comment.no));
    const setReply = usePreviewStore((s) => s.setReply);
    const toggleCollapse = usePreviewStore((s) => s.toggleCollapse);

    const isDeleted = comment.is_delete === "1";
    const isAdmin = isGalleryManager();
    const canDelete =
        !isDeleted && (comment.del_btn === "Y" || comment.my_cmt === "Y" || isAdmin || (!comment.user_id && Boolean(comment.ip)));

    const onDelete = async (): Promise<void> => {
        const st = usePreviewStore.getState();
        if (!st.preData || !st.post) return;

        // 비밀번호 없이 지워지는 삭제(관리자·회원 본인)는 X 한 번에 되돌릴 수 없으니 확인한다 (디시 comment.js와 같음). 비밀번호 삭제는 prompt가 확인 역할
        const needsPassword = !isAdmin && !comment.user_id;
        if (!needsPassword && !window.confirm("댓글을 삭제하시겠습니까?")) return;

        try {
            if (isAdmin) {
                if (!notifyManage(await adminDeleteComment(st.preData, comment.no), "댓글을 삭제했습니다.")) return;
            } else {
                let password = "";
                if (needsPassword) {
                    password = window.prompt("비밀번호를 입력하세요.") ?? "";
                    if (!password) return;
                }
                // 비밀번호가 틀려도 HTTP 200('false||메시지')이라 결과를 보여 주지 않으면 조용히 실패한다
                if (!notifyManage(await userDeleteComment(st.preData, comment.no, password), "댓글을 삭제했습니다.")) return;
            }
            st.requestRefresh();
        } catch {
            useUiStore.getState().showToast("댓글 삭제 중 오류가 발생했습니다.", "error");
        }
    };

    // 디시콘(img/video)과 글자콘 — 답글이면 앞에 멘션이 붙어 오므로 맨 앞에 고정하지 않고 찾는다
    const isDccon = /<(img|video) class=|<div class="coment_dccon_txt/.test(comment.memo);
    // 붙어 온 디시콘 태그는 comments.ts에서 이미 떼어 놓았다
    const html = isDccon ? comment.memo : comment.memo.replace(/\n/g, "<br/>");

    // 글자콘 크기는 그려진 뒤에 잰다 — html이 바뀌면 React가 내용을 새로 넣으므로 다시 잰다
    const body = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        body.current?.querySelectorAll<HTMLElement>(".coment_dccon_txt").forEach(fitTxtcon);
    }, [html]);

    return (
        <Box className="refresher-comment" data-depth={depth} data-deleted={isDeleted || undefined}
             data-thread-open={threadOpen || undefined} data-last-reply={lastReply || undefined} px="6" py="2">
            <Flex justify="between" align="center" gap="2">
                <Flex align="center" gap="1" minWidth="0">
                    <UserCard user={{
                        nick: comment.name,
                        id: comment.user_id,
                        ip: comment.ip || extractIp(comment.gallog_icon) || extractIp(comment.nickname as string | undefined),
                        image: extractIcon(comment.gallog_icon)
                    }}/>
                    {depth === 0 && replyCount > 1 && (
                        <Tooltip content={collapsed ? "답글 펼치기" : "답글 접기"} container={overlay.portal}>
                            <IconButton size="1" variant="ghost" color="gray" aria-label="답글 접기"
                                        onClick={() => toggleCollapse(comment.no)}>
                                <ChevronDown size={14} style={{transform: collapsed ? "rotate(-90deg)" : undefined}}/>
                            </IconButton>
                        </Tooltip>
                    )}
                </Flex>

                <Flex align="center" gap="3" flexShrink="0">
                    {!isDeleted && (
                        <IconButton
                            size="1"
                            // ghost 고정 — soft로 바꾸면 Radix가 여백을 달리 줘서 댓글 줄이 흔들린다
                            variant="ghost"
                            color={replying ? undefined : "gray"}
                            aria-label={replying ? "답글 취소" : "답글"}
                            aria-pressed={replying}
                            onClick={() =>
                                // 같은 댓글을 다시 누르면 취소. 답글의 부모는 쓰레드 첫 댓글(c_no), 첫 댓글이면 자기 자신
                                setReply(replying
                                    ? {commentNo: null, replyNo: null}
                                    : {commentNo: comment.c_no || comment.no, replyNo: comment.no})
                            }
                        >
                            {replying ? <Check size={14}/> : <ReplyIcon size={14}/>}
                        </IconButton>
                    )}
                    {canDelete && (
                        <IconButton size="1" variant="ghost" color="gray" aria-label="댓글 삭제"
                                    onClick={() => void onDelete()}>
                            <X size={14}/>
                        </IconButton>
                    )}
                    <TimeStamp date={String(comment.reg_date ?? comment.date_time ?? "")}/>
                </Flex>
            </Flex>

            <Flex direction="column" gap="1" mt="1">
                {comment.voice &&
                    (comment.voice.iframe ? (
                        <iframe src={comment.voice.src} width={280} height={54} style={{border: 0}} title="voice"/>
                    ) : (
                        <audio controls src={comment.voice.src}/>
                    ))}
                <Box ref={body} className="refresher-html refresher-comment-html" data-dccon={isDccon || undefined}
                     dangerouslySetInnerHTML={{__html: html}}/>
            </Flex>
        </Box>
    );
};

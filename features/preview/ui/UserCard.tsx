import {Fragment, type MouseEvent, type ReactNode, useSyncExternalStore} from "react";
import {useShallow} from "zustand/react/shallow";

import {banReasonsOf, databaseVersion, ipInfoOf, passesIpFilter, subscribeDatabase} from "@/core/database";
import type {User} from "@/core/preview/types";
import {useUserMemo} from "@/stores/memos";
import {type BadgeKey, isFresh, isLowActivity, showsUid, useUiStore} from "@/stores/ui";
import {useGallogActivity} from "@/components/overlay/gallogActivity";
import {cn} from "cn";

import {usePreviewStore} from "./previewStore";

/**
 * 작성자 표시. 우클릭하거나 닉네임을 누르면(키보드 포함) 유저 버블을 연다.
 * fetchRatio: 글댓비가 캐시에 없으면 갤로그에서 받는다. 댓글마다 받으면 요청이 너무 많아 글쓴이에게만 켠다.
 * op: 글쓴이가 단 댓글. v5처럼 작성자 칸을 파랗게 칠한다. 닉네임만 칩 색으로, 배지(아이디·IP·글댓비·갱차·메모)는 설정한 색 그대로 둔다.
 */
export const UserCard = ({user, fetchRatio, op}: { user: User; fetchRatio?: boolean; op?: boolean }) => {
    // 배지 순서·표시 조건은 페이지와 같게 userinfo 설정을 따른다. 회원은 UID, 유동만 IP 정보를 단다.
    const view = useUiStore((state) => state.badgeView);
    // IP·밴 조회 식에 dbVersion을 넣는다. 빠지면 React Compiler가 인자만 보고 메모해 DB를 읽은 뒤에도 옛 값이 남는다.
    const dbVersion = useSyncExternalStore(subscribeDatabase, databaseVersion);
    const ipInfo = dbVersion > 0 && !user.id && user.ip ? ipInfoOf(user.ip) : undefined;
    const ipColor = useUiStore((state) => (ipInfo ? state.badgeColors[ipInfo.category] : undefined));
    const banColor = useUiStore((state) => state.badgeColors.permBan);
    // 갱차 조회를 켰을 때(banColor)만 찾는다. 밴 색인(수 MB)은 처음 조회할 때 만든다.
    const banReasons = dbVersion > 0 && user.id && banColor ? banReasonsOf(user.id) : undefined;
    const uidColor = useUiStore((state) => state.badgeColors.uid);
    const gallery = usePreviewStore((s) => s.preData?.gallery);
    const memo = useUserMemo({uid: user.id, ip: user.ip, nick: user.nick}, gallery);
    // 글댓비는 이 사람 것만 구독한다. 캐시 전체를 구독하면 누구 것이든 저장될 때마다 모든 댓글의 작성자가 다시 그려진다.
    // hasOwn은 아이디가 constructor 같은 프로토타입 키일 때 캐시로 잘못 잡히지 않게 한다.
    // 1시간이 지난 값도 페이지처럼 보이고, 글쓴이(fetchRatio)만 새로 받아 받는 대로 바꾼다.
    const showsRatio = useUiStore((state) => state.ratios !== null);
    const alarm = useUiStore((state) => state.ratios?.alarm ?? 0);
    const cached = useUiStore(useShallow((state) =>
        user.id && state.ratios && Object.hasOwn(state.ratios.cache, user.id) ? state.ratios.cache[user.id] : undefined));
    const fetched = useGallogActivity(fetchRatio && showsRatio && !isFresh(cached) ? user.id : undefined);
    const ratio = (typeof fetched === "object" ? fetched : undefined) ?? cached;
    const ratioColor = useUiStore((state) => (ratio && isLowActivity(ratio, alarm) ? state.badgeColors.ratioAlarm : state.badgeColors.ratio));

    const openBubble = (x: number, y: number): void => useUiStore.getState().openBubble({nick: user.nick, uid: user.id, ip: user.ip}, x, y);

    const openMenu = (ev: MouseEvent): void => {
        // 목록과 같이 Shift+우클릭은 브라우저 기본 메뉴로 남긴다.
        if (ev.shiftKey) return;
        ev.preventDefault();
        openBubble(ev.clientX, ev.clientY);
    };

    // 설정한 색이 없으면 아이디·IP는 회색, IP 정보는 파랑이다.
    const identityClass = cn("truncate text-xs", !uidColor && "text-muted-foreground");

    const badges: Record<BadgeKey, ReactNode> = {
        UID: user.id
            ? showsUid(view, user.image) && <span className={identityClass} style={{color: uidColor}}>({user.id})</span>
            : ipInfo && passesIpFilter(ipInfo, view.ipFilter) &&
            <span className={cn("truncate text-xs", !ipColor && "text-blue-600 dark:text-blue-400")} style={{color: ipColor}} title={ipInfo.title}>[{ipInfo.label}]</span>,
        MEMO: memo && <span className="truncate text-xs" style={{color: memo.color || undefined}} title={memo.text}>[{memo.text}]</span>,
        RATIO: ratio && <span className="truncate text-xs" style={{color: ratioColor}} title="글/댓글">[{ratio.article}/{ratio.comment}]</span>,
        PERMBAN: banReasons && banColor && <span className="truncate text-xs" style={{color: banColor}} title={banReasons}>[{banReasons}]</span>
    };

    return (
        <div className={cn("refresher-user flex min-w-0 cursor-context-menu items-center gap-1", op && "rounded-md bg-primary/15 px-1.5 py-px text-link")}
             onContextMenu={openMenu}>
            {/* 버블은 닉네임 바로 아래에 띄운다. 키보드로 열면 버블 안으로 포커스가 옮겨 간다 (components/overlay/UserBubble.tsx의 useReturnFocus). */}
            <button type="button" aria-haspopup="dialog"
                    className="cursor-pointer truncate rounded-sm text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    onClick={(ev) => {
                        const rect = ev.currentTarget.getBoundingClientRect();
                        openBubble(rect.left, rect.bottom);
                    }}>
                {user.nick ?? user.id ?? user.ip}
            </button>
            {user.image && <img src={user.image} alt="" height={12}/>}
            {/* 유동 IP는 디시가 닉 옆에 바로 보여 주는 값이라 배지 순서와 상관없이 여기 둔다. */}
            {user.ip && <span className={identityClass} style={{color: uidColor}}>({user.ip})</span>}
            {view.order.map((key) => <Fragment key={key}>{badges[key]}</Fragment>)}
        </div>
    );
};

import {type WheelEvent, useRef, useState} from "react";

/** 휠 이벤트 사이가 이보다 벌어지면 새 동작으로 본다(ms). 관성 스크롤은 이보다 촘촘하게 이어진다. */
const WHEEL_GESTURE_GAP = 250;

/** 스크롤 칸이 그 방향(1 아래, -1 위)으로 더 굴러가는지. 아래쪽은 배율에 따른 소수점 오차로 2px 여유를 둔다. */
const canScroll = (el: Element, dir: number): boolean => (dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 2 : el.scrollTop > 0);

/**
 * 스크롤 끝에서 새로 한 번 더 굴리면 이전/다음 글로 넘어간다 (Frame의 스크롤 칸). 끝에 닿은 그 동작으로 넘기면
 * 트랙패드 관성에 글이 연달아 넘어간다. 끝에 닿으면 v5처럼 안내를 띄우고, 넘기거나 닫았다 열면 지운다
 * (hint.key가 지금 글일 때만 보인다). enabled(scrollToSkip)가 꺼져 있으면 아무것도 하지 않는다.
 */
export const useWheelGesture = (key: string, goToAdjacent: (dir: number) => void, enabled: boolean) => {
    const wheel = useRef({last: 0, armed: 0, key: "", settling: false});
    const [hint, setHint] = useState({dir: 0, key: ""});

    const skipOnWheel = (dir: number, timeStamp: number, atEdge: boolean): void => {
        const state = wheel.current;
        // 앞 글에서 끝에 닿아 둔 상태는 버린다.
        if (state.key !== key) {
            state.key = key;
            state.armed = 0;
        }
        const newGesture = timeStamp - state.last > WHEEL_GESTURE_GAP;
        state.last = timeStamp;

        // 넘기게 한 동작(관성 포함)이 새 글에서 이어지면 무시한다. 새 글은 맨 위에서 열려, 위로 넘기면 곧바로 끝에 닿은 것으로 잡힌다.
        if (state.settling) {
            if (!newGesture) return;
            state.settling = false;
        }

        let armed = 0;
        if (atEdge && newGesture && state.armed === dir) {
            state.settling = true;
            goToAdjacent(dir);
        }
        // 끝에 닿은 방향을 기억해 두고 다음 동작을 기다린다.
        else if (atEdge) armed = dir;

        if (armed !== state.armed) setHint({dir: armed, key});
        state.armed = armed;
    };

    const onWheel = (ev: WheelEvent<HTMLDivElement>): void => {
        if (!enabled || ev.deltaY === 0 || ev.ctrlKey || ev.shiftKey) return;

        const box = ev.currentTarget;
        const target = ev.target;
        // 포털로 뜬 창(디시콘 등)의 휠도 React 트리를 타고 여기로 오므로, 스크롤 칸 DOM 안에서 난 것만 본다.
        if (!(target instanceof Element) || !box.contains(target)) return;

        const dir = ev.deltaY > 0 ? 1 : -1;
        // 창이 아직 굴러가면 끝이 아니다. 끝일 때만 안쪽 스크롤 칸(댓글 입력칸 등)을 본다: 그쪽이 굴러가면 그쪽 스크롤이라 끝으로 치지 않는다.
        // 읽는 동안 휠마다 조상을 getComputedStyle로 훑지 않게 순서를 이렇게 둔다.
        let atEdge = !canScroll(box, dir);
        for (let el: Element | null = target; atEdge && el && el !== box; el = el.parentElement) {
            if (el.scrollHeight > el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY) && canScroll(el, dir)) atEdge = false;
        }
        skipOnWheel(dir, ev.timeStamp, atEdge);
    };

    return {onWheel, hint};
};

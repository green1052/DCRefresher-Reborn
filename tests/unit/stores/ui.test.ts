import {describe, expect, it, vi} from "vitest";

import {DEFAULT_BADGE_VIEW, isFresh, isLowActivity, showsUid, useUiStore} from "@/stores/ui";

const ICON = "https://nstatic.dcinside.com/dc/w/images/";

describe("showsUid", () => {
    it("고정닉·반고정닉은 각 설정을 따르고, 닉콘이 없거나 모르는 닉콘이면 늘 보인다", () => {
        const view = {...DEFAULT_BADGE_VIEW, fixedUid: false, halfFixedUid: true};
        expect(showsUid(view, `${ICON}fix_managernik.gif`)).toBe(false);
        expect(showsUid(view, `${ICON}managernik.gif`)).toBe(true);
        expect(showsUid({...view, halfFixedUid: false}, `${ICON}managernik.gif`)).toBe(false);
        expect(showsUid(view)).toBe(true);
        expect(showsUid(view, `${ICON}unknown.gif`)).toBe(true);
    });
});

describe("isLowActivity", () => {
    it("글댓합이 기준 이하일 때만 깡계다. 기준 0은 끈 것이다", () => {
        expect(isLowActivity({article: 3, comment: 7}, 10)).toBe(true);
        expect(isLowActivity({article: 3, comment: 8}, 10)).toBe(false);
        expect(isLowActivity({article: 0, comment: 0}, 0)).toBe(false);
    });
});

describe("isFresh", () => {
    it("1시간 안에 받은 값만 새 값이다", () => {
        vi.useFakeTimers({now: 10_000_000});
        expect(isFresh({date: 10_000_000 - 3600_000})).toBe(true);
        expect(isFresh({date: 10_000_000 - 3600_001})).toBe(false);
        expect(isFresh(undefined)).toBe(false);
    });
});

describe("토스트", () => {
    it("여러 토스트가 떠도 되돌리기 액션이 지워지지 않고, 3개까지만 쌓인다", () => {
        const {showToast, dismissToast} = useUiStore.getState();
        useUiStore.setState({toasts: []});

        showToast("차단을 해제했습니다.", "info", 5000, {label: "되돌리기", run: () => {}});
        showToast("저장했습니다.");
        showToast("불러왔습니다.");
        let toasts = useUiStore.getState().toasts;
        expect(toasts).toHaveLength(3);
        expect(toasts[0].action?.label).toBe("되돌리기");

        // 넘친 토스트는 가장 오래된 것부터 버린다.
        showToast("네 번째");
        toasts = useUiStore.getState().toasts;
        expect(toasts).toHaveLength(3);
        expect(toasts[0].content).toBe("저장했습니다.");
        expect(toasts[0].action).toBeUndefined();

        dismissToast(toasts[0].id);
        expect(useUiStore.getState().toasts).toHaveLength(2);
    });
});

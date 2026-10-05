/**
 * 오버레이를 띄울 조건. 오버레이(shadow DOM·React)는 그릴 것이 처음 생길 때 띄운다 (entrypoints/content/overlay.tsx).
 * 오버레이에 UI를 그리는 스토어가 "이 상태면 그릴 것이 있다"를 여기에 등록한다. 새 UI는 자기 스토어의 조건만 고치면 된다.
 * 매 페이지 setup이 채우는 값(배지 색·차단 보기 등)은 조건에 넣지 않는다. 넣으면 늘 띄운다.
 */

interface Demand {
    needed(): boolean;
    subscribe(listener: () => void): () => void;
}

const demands: Demand[] = [];

interface Subscribable<S> {
    getState(): S;
    subscribe(listener: (state: S) => void): () => void;
}

/** store가 needed를 만족하면 오버레이를 띄운다. 스토어를 만드는 모듈에서 부른다 (콘텐츠 스크립트가 처음 불러올 때 등록된다). */
export const needOverlayWhen = <S>(store: Subscribable<S>, needed: (state: S) => boolean): void => {
    demands.push({needed: () => needed(store.getState()), subscribe: (listener) => store.subscribe(listener)});
};

export const overlayNeeded = (): boolean => demands.some((demand) => demand.needed());

/** 조건이 바뀔 수 있을 때마다 부른다. 해제 함수를 돌려준다. */
export const watchOverlayDemands = (listener: () => void): (() => void) => {
    const offs = demands.map((demand) => demand.subscribe(listener));
    return () => {
        for (const off of offs) off();
    };
};

// 그릴 것이 처음 생길 때 오버레이를 띄우게 UI 스토어가 조건을 등록한다 - 매 페이지 setup 값은 넣으면 늘 뜨니까 뺀다.

interface Demand {
    needed(): boolean;
    subscribe(listener: () => void): () => void;
}

const demands: Demand[] = [];

interface Subscribable<S> {
    getState(): S;
    subscribe(listener: (state: S) => void): () => void;
}

export const needOverlayWhen = <S>(store: Subscribable<S>, needed: (state: S) => boolean): void => {
    demands.push({needed: () => needed(store.getState()), subscribe: (listener) => store.subscribe(listener)});
};

export const overlayNeeded = (): boolean => demands.some((demand) => demand.needed());

export const watchOverlayDemands = (listener: () => void): (() => void) => {
    const offs = demands.map((demand) => demand.subscribe(listener));
    return () => {
        for (const off of offs) off();
    };
};

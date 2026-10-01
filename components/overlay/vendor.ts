import type * as React from "react";
import type * as JsxRuntime from "react/jsx-runtime";
import type * as RadixUi from "radix-ui";
import type * as RadixInternal from "radix-ui/internal";
import type * as ReactDomClient from "react-dom/client";

/**
 * 콘텐츠 스크립트와 오버레이 라이브러리(entrypoints/overlay-vendor.ts)가 주고받는 것. 두 스크립트는 따로 빌드되어
 * 모듈을 같이 쓸 수 없으므로, 같은 격리 world의 전역 하나씩으로 넘긴다. 빌드 쪽 연결은 modules/overlay-vendor.ts가 한다.
 */

/** 콘텐츠 스크립트 → 오버레이 라이브러리: React. 두 벌이면 훅이 서로 다른 React를 봐서 깨진다. */
export interface SharedReact {
    react: typeof React;
    jsxRuntime: typeof JsxRuntime;
}

/** 오버레이 라이브러리 → 콘텐츠 스크립트. */
export interface OverlayVendor {
    radixUi: typeof RadixUi;
    radixInternal: typeof RadixInternal;
    reactDomClient: typeof ReactDomClient;
}

declare global {
    var __refresherReact: SharedReact | undefined;
    var __refresherVendor: OverlayVendor | undefined;
}

export const REACT_GLOBAL = "__refresherReact" satisfies keyof typeof globalThis;
export const VENDOR_GLOBAL = "__refresherVendor" satisfies keyof typeof globalThis;

export const shareReact = (shared: SharedReact): void => {
    globalThis[REACT_GLOBAL] = shared;
};

export const provideOverlayVendor = (vendor: OverlayVendor): void => {
    globalThis[VENDOR_GLOBAL] = vendor;
};

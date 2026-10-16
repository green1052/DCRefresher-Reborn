// "react"(preact/compat) 타입의 CSSProperties에 CSS 사용자 정의 속성(--x)을 허용한다. style에 넣을 때 as CSSProperties를 쓰지 않으려고.
export {};

declare module "react" {
    interface CSSProperties {
        [key: `--${string}`]: string | number | undefined;
    }
}

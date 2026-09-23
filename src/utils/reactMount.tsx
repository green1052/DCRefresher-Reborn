import {createRoot, type Root} from "react-dom/client";
import type {ComponentType} from "react";

// React 트리 안에서 렌더할 수 있으면 그게 우선이다. 이 헬퍼는 controller 같은
// 명령형 컨텍스트에서 부득이하게 컴포넌트를 body에 붙여야 할 때만 쓴다.
export interface MountedReactNode {
    root: Root;
    element: HTMLDivElement;
}

export const mountReactNode = <P extends object>(
    Component: ComponentType<P>,
    props: P
): MountedReactNode => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const root = createRoot(element);
    root.render(<Component {...props}/>);

    return {root, element};
};

export const unmountReactNode = (mounted: MountedReactNode): void => {
    mounted.root.unmount();
    mounted.element.remove();
};

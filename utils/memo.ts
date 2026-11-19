import { Component, createElement } from "preact";
import type { ComponentChild, ComponentType } from "preact";

const shallowDiffers = (a: Record<string, unknown>, b: Record<string, unknown>): boolean => {
    for (const key in a) if (!(key in b)) return true;
    for (const key in b) if (a[key] !== b[key]) return true;
    return false;
};

/** preact 코어에는 memo가 없어 preact/compat의 구현을 가져왔다 - props가 얕게 같으면 다시 그리지 않는다. */
export function memo<P>(component: (props: P) => ComponentChild, comparer?: (prev: P, next: P) => boolean): ComponentType<P> {
    class Memoed extends Component<P> {
        static override displayName = `memo(${(component as {name?: string}).name ?? "anonymous"})`;
        override shouldComponentUpdate(nextProps: P): boolean {
            return comparer ? !comparer(this.props, nextProps) : shallowDiffers(this.props as Record<string, unknown>, nextProps as Record<string, unknown>);
        }

        override render(): ComponentChild {
            return createElement(component, this.props);
        }
    }
    return Memoed as ComponentType<P>;
}

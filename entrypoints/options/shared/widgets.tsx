import {Search} from "lucide-preact";
import type { ComponentProps, ComponentChild as ReactNode } from "preact";

import {cn} from "cn";

export const Section = ({title, desc, actions, children}: {
    title?: ReactNode;
    desc?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode
}) => (
    // data-slot=card는 e2e 계약(설정 카드 수/찾기)이다.
    <div data-slot="card" className="card card-border mb-4">
        <div className="card-body gap-6 p-6">
            {(title || desc || actions) && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col items-start gap-1.5">
                        {title && <h2 className="leading-none font-semibold">{title}</h2>}
                        {desc && <p className="text-sm text-base-content/60">{desc}</p>}
                    </div>
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            )}
            {children}
        </div>
    </div>
);

/** 돋보기가 붙은 검색 입력. className은 감싸는 label에 붙는다. onChange은 react처럼 칠 때마다 움직이게 onInput으로 건다. */
export const SearchInput = ({className, onChange, ...props}: ComponentProps<"input">) => (
    <label className={cn("input", className)}>
        <Search className="size-4 shrink-0 opacity-50"/>
        <input {...{type: "search", ...props, onInput: onChange} as ComponentProps<"input">} className="grow"/>
    </label>
);

export const EmptyList = ({children}: { children: ReactNode }) => (
    <p className="w-full p-8 text-center text-sm text-base-content/60">{children}</p>
);

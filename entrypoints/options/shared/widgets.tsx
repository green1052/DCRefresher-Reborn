import {Search} from "lucide-react";
import type {ComponentProps, ReactNode} from "react";

import {Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Empty, EmptyDescription} from "@/components/ui/empty";
import {InputGroup, InputGroupAddon, InputGroupInput} from "@/components/ui/input-group";

export const Section = ({title, desc, actions, children}: {
    title?: ReactNode;
    desc?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode
}) => (
    <Card className="mb-4">
        {(title || desc || actions) && (
            <CardHeader>
                {title && <CardTitle><h2>{title}</h2></CardTitle>}
                {desc && <CardDescription>{desc}</CardDescription>}
                {actions && <CardAction className="flex items-center gap-2">{actions}</CardAction>}
            </CardHeader>
        )}
        {children && <CardContent>{children}</CardContent>}
    </Card>
);

/** 돋보기가 붙은 검색 입력. className은 감싸는 InputGroup에 붙는다. */
export const SearchInput = ({className, ...props}: ComponentProps<typeof InputGroupInput>) => (
    <InputGroup className={className}>
        <InputGroupAddon>
            <Search/>
        </InputGroupAddon>
        <InputGroupInput type="search" {...props}/>
    </InputGroup>
);

/** 빈 목록·검색 결과 없음 안내. */
export const EmptyList = ({children}: { children: ReactNode }) => (
    <Empty>
        <EmptyDescription>{children}</EmptyDescription>
    </Empty>
);

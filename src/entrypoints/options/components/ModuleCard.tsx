import {Card, Flex, Switch, Text} from "@radix-ui/themes";
import {useEffect, useRef} from "react";

import {useAppContext} from "../../popup/context";

interface Props {
    name: string;
    desc: string;
    enabled: boolean;
}

export default function ModuleCard({name, desc, enabled}: Props) {
    const {settings, highlightModule, dismissHighlightModule} = useAppContext();
    const rootRef = useRef<HTMLDivElement>(null);
    const highlighted = highlightModule === name;

    // 일반 탭에서 이 모듈이 선택되면 모듈 탭이 새로 마운트되므로 여기서 1회 스크롤+강조.
    useEffect(() => {
        if (!highlighted) return;
        rootRef.current?.scrollIntoView({behavior: "smooth", block: "center"});
        const timer = setTimeout(dismissHighlightModule, 1000);
        return () => clearTimeout(timer);
    }, [highlighted]);

    return (
        <Card
            ref={rootRef}
            size="2"
            style={highlighted ? {outline: "2px solid var(--accent-a9)"} : undefined}
        >
            <Flex align="center" gap="3" justify="between">
                <div>
                    <Text as="div" size="3" weight="medium">{name}</Text>
                    <Text as="div" color="gray" size="1">{desc}</Text>
                </div>
                <Switch
                    checked={enabled}
                    onCheckedChange={(value) => void settings.updateModuleStatus(name, value)}
                />
            </Flex>
        </Card>
    );
}

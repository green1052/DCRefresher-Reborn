import {Box, Switch, Text} from "@radix-ui/themes";

import {useModulesStore} from "@/stores/modules";

import {Empty, Row, Section} from "./Layout";

/** 모듈 on/off만 표시. 세부 설정은 일반 탭에 있다 */
export function ModuleTab() {
    const schemas = useModulesStore((state) => state.schemas);
    const unavailable = useModulesStore((state) => state.unavailable);
    const tabId = useModulesStore((state) => state.tabId);
    const toggle = useModulesStore((state) => state.toggle);

    if (unavailable) return <Empty>디시인사이드 탭을 열어주세요.</Empty>;

    if (schemas.length === 0) return <Empty>모듈이 없습니다.</Empty>;

    return (
        <Section title="모듈" desc="모듈을 켜고 끕니다. 세부 설정은 일반 탭에 있습니다.">
            {schemas.map((schema) => (
                <Row
                    key={schema.id}
                    left={
                        <Text size="2" color={schema.enable ? undefined : "gray"}>
                            {schema.name}
                        </Text>
                    }
                    right={<Switch size="1" checked={schema.enable} onCheckedChange={(value) => void toggle(schema.id, value, tabId)} />}
                />
            ))}
        </Section>
    );
}

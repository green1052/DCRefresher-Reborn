import {Box, Flex, Link, Text} from "@radix-ui/themes";

import {SettingItem} from "@/components/SettingItem";
import {useModulesStore} from "@/stores/modules";

import {Empty, Section} from "./Layout";

const LINKS: [string, string][] = [
    ["GitHub", "https://github.com/green1052/DCRefresher-Reborn"],
    ["갤러리", "https://gall.dcinside.com/mini/board/lists/?id=bjwg64"],
    ["Discord", "https://discord.gg/SSW6Zuyjz6"],
    ["후원", "https://www.buymeacoffee.com/green1052"],
    ["도움말", "https://dcrefresher.green1052.com"]
];

export function GeneralTab() {
    const schemas = useModulesStore((state) => state.schemas);
    const unavailable = useModulesStore((state) => state.unavailable);
    const tabId = useModulesStore((state) => state.tabId);
    const changeSetting = useModulesStore((state) => state.changeSetting);

    return (
        <Box>
            <Section title="DCRefresher Reborn">
                <Text as="div" size="2" color="gray" mb="2">
                    버전 {browser.runtime.getManifest().version}
                </Text>
                <Flex gap="4" wrap="wrap">
                    {LINKS.map(([text, url]) => (
                        <Link key={url} href={url} target="_blank" rel="noreferrer">
                            {text}
                        </Link>
                    ))}
                </Flex>
            </Section>

            {unavailable && <Empty>우선 디시인사이드 페이지를 열고 설정해주세요.</Empty>}

            {schemas.map((schema) => {
                if (!schema.settings) return null;

                return (
                    <Section key={schema.id} title={schema.name} desc={schema.description}>
                        {Object.entries(schema.settings).map(([key, settingSchema]) => (
                            <SettingItem
                                key={key}
                                schema={settingSchema}
                                value={schema.values?.[key] ?? settingSchema.default}
                                disabled={!schema.enable}
                                onChange={(value) => void changeSetting(schema.id, key, value, tabId)}
                            />
                        ))}
                    </Section>
                );
            })}
        </Box>
    );
}

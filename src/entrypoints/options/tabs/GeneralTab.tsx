import {Box, Callout, Card, Flex, Heading, Link, Text} from "@radix-ui/themes";
import {ChevronRight} from "lucide-react";

import iconUrl from "@/assets/icon.png";
import {useAppContext} from "../../popup/context";
import SettingItem from "../components/SettingItem";

const links = [
    {text: "GitHub", url: "https://github.com/green1052/DCRefresher-Reborn"},
    {text: "갤러리", url: "https://gall.dcinside.com/mini/board/lists/?id=bjwg64"},
    {text: "Discord", url: "https://discord.gg/SSW6Zuyjz6"},
    {text: "후원", url: "https://www.buymeacoffee.com/green1052"},
    {text: "도움말", url: "https://dcrefresher.green1052.com"}
];

export default function GeneralTab() {
    const {settings, moveToModuleTab} = useAppContext();
    const {modules, settings: moduleSettings, hasSettings, modulesWithBasicSettings} = settings;

    const version = import.meta.env.DEV
        ? `${browser.runtime.getManifest().version}-dev`
        : browser.runtime.getManifest().version;

    return (
        <Flex direction="column" gap="4" pt="4">
            <Card size="3">
                <Flex align="center" gap="4">
                    <img
                        height={64}
                        src={iconUrl}
                        width={64}
                    />
                    <Box>
                        <Heading size="4">DCRefresher Reborn</Heading>
                        <Text as="div" color="gray" size="1">v{version}</Text>
                        <Flex gap="3" mt="1">
                            {links.map((link) => (
                                <Link
                                    href={link.url}
                                    key={link.url}
                                    size="1"
                                    target="_blank"
                                >
                                    {link.text}
                                </Link>
                            ))}
                        </Flex>
                    </Box>
                </Flex>
            </Card>

            {!hasSettings ? (
                <Callout.Root color="gray">
                    <Callout.Text>우선 디시인사이드 페이지를 열고 설정 해주세요.</Callout.Text>
                </Callout.Root>
            ) : (
                modulesWithBasicSettings.map((moduleName) => (
                    <Card key={moduleName} size="3">
                        <Flex
                            align="center"
                            gap="1"
                            mb="2"
                            onClick={() => moveToModuleTab(moduleName)}
                            style={{cursor: "pointer"}}
                        >
                            <Heading size="3">
                                {moduleName}
                                {modules[moduleName]?.enable ? "" : " (비활성화)"}
                            </Heading>
                            <ChevronRight size={16}/>
                        </Flex>

                        <Flex direction="column">
                            {Object.keys(moduleSettings[moduleName] ?? {}).map((settingKey) => (
                                <SettingItem
                                    key={`${moduleName}-${settingKey}`}
                                    moduleEnabled={modules[moduleName]?.enable ?? false}
                                    moduleName={moduleName}
                                    setting={(moduleSettings[moduleName] ?? {})[settingKey]!}
                                    settingKey={settingKey}
                                />
                            ))}
                        </Flex>
                    </Card>
                ))
            )}
        </Flex>
    );
}

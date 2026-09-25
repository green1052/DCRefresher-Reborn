import {Button, Flex, Kbd, Separator, Text} from "@radix-ui/themes";
import {ExternalLink} from "lucide-react";
import {Fragment, useEffect, useState} from "react";

import {Section} from "./Layout";

interface ShortcutCommand {
    name?: string;
    description?: string;
    shortcut?: string;
}

export function ShortcutTab() {
    const [shortcuts, setShortcuts] = useState<ShortcutCommand[]>([]);

    useEffect(() => {
        const load = (): void => void browser.commands.getAll().then((commands) => setShortcuts(commands as ShortcutCommand[]));
        load();
        // 브라우저의 단축키 설정에서 바꾸고 돌아오면 다시 읽는다 — 바뀌었다는 이벤트가 없다
        window.addEventListener("focus", load);
        return () => window.removeEventListener("focus", load);
    }, []);

    return (
        <Section
            desc="단축키는 브라우저의 확장 프로그램 단축키 설정에서 변경할 수 있습니다."
            actions={
                <Button
                    variant="soft"
                    onClick={() =>
                        // Firefox는 tabs.create로 about:addons를 열 수 없다 — 전용 API(137+, 타입엔 아직 없음)를 쓴다
                        void (import.meta.env.FIREFOX
                            ? (browser.commands as unknown as { openShortcutSettings: () => Promise<void> }).openShortcutSettings()
                            : browser.tabs.create({url: "chrome://extensions/shortcuts"}))
                    }
                >
                    <ExternalLink size={14}/> 단축키 설정
                </Button>
            }
        >
            {shortcuts
                .filter((shortcut) => shortcut.description)
                .map((shortcut) => (
                    <Fragment key={shortcut.name}>
                        <Separator size="4"/>
                        <Flex justify="between" align="center" gap="3" py="3">
                            <Text size="2">{shortcut.description}</Text>
                            {shortcut.shortcut ? <Kbd>{shortcut.shortcut}</Kbd> :
                                <Text size="2" color="gray">없음</Text>}
                        </Flex>
                    </Fragment>
                ))}
        </Section>
    );
}

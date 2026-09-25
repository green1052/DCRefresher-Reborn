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
        void browser.commands.getAll().then((commands) => setShortcuts(commands as ShortcutCommand[]));
    }, []);

    return (
        <Section
            desc="단축키는 브라우저의 확장 프로그램 단축키 설정에서 변경할 수 있습니다."
            actions={
                <Button
                    variant="soft"
                    onClick={() =>
                        void browser.tabs.create({url: import.meta.env.FIREFOX ? "about:addons" : "chrome://extensions/shortcuts"})
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

import {Button, Flex, Text} from "@radix-ui/themes";
import {useEffect, useState} from "react";

import {Empty} from "./Layout";

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
        <Flex direction="column" gap="3">
            {shortcuts
                .filter((shortcut) => shortcut.description)
                .map((shortcut) => (
                    <Flex key={shortcut.name} justify="between" align="center" py="2">
                        <Text size="2">{shortcut.description}</Text>
                        <Text size="2" color="gray">
                            {shortcut.shortcut || "없음"}
                        </Text>
                    </Flex>
                ))}
            <Empty>
                <Button
                    variant="soft"
                    onClick={() =>
                        void browser.tabs.create({url: import.meta.env.FIREFOX ? "about:addons" : "chrome://extensions/shortcuts"})
                    }
                >
                    단축키 설정
                </Button>
            </Empty>
        </Flex>
    );
}

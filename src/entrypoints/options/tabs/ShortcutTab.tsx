import type {Browser} from "#imports";
import {Badge, Button, Card, Flex, Text} from "@radix-ui/themes";
import {useEffect, useState} from "react";

export default function ShortcutTab() {
    const [shortcuts, setShortcuts] = useState<Browser.commands.Command[]>([]);

    const openShortcutSettings = () => {
        browser.tabs.create({
            url: (import.meta.env.FIREFOX as boolean) ? "about:addons" : "chrome://extensions/shortcuts"
        });
    };

    useEffect(() => {
        void browser.commands.getAll().then(setShortcuts);
    }, []);

    return (
        <Flex direction="column" gap="3" pt="4">
            {shortcuts.map((shortcut) =>
                shortcut.description?.length ? (
                    <Card key={shortcut.name} size="1">
                        <Flex align="center" gap="3" justify="between">
                            <Text size="2">{shortcut.description}</Text>
                            <Badge variant="surface">{shortcut.shortcut || "없음"}</Badge>
                        </Flex>
                    </Card>
                ) : null
            )}

            <Button
                onClick={openShortcutSettings}
                size="1"
                style={{alignSelf: "flex-start"}}
                variant="soft"
            >
                단축키 설정
            </Button>
        </Flex>
    );
}

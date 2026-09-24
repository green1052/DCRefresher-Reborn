import {Button} from "@radix-ui/themes";
import {useEffect, useState} from "react";

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
        <div>
            {shortcuts
                .filter((shortcut) => shortcut.description)
                .map((shortcut) => (
                    <div key={shortcut.name} className="refresher-module-row">
                        <div className="refresher-module-text">
                            <div className="refresher-module-name">{shortcut.description}</div>
                        </div>
                        <span className="refresher-module-desc">{shortcut.shortcut || "없음"}</span>
                    </div>
                ))}
            <div className="empty">
                <Button
                    variant="soft"
                    onClick={() =>
                        void browser.tabs.create({url: import.meta.env.FIREFOX ? "about:addons" : "chrome://extensions/shortcuts"})
                    }
                >
                    단축키 설정
                </Button>
            </div>
        </div>
    );
}

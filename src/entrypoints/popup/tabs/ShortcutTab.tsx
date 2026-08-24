import type {Browser} from "#imports";
import {useEffect, useState} from "react";

import Bubble from "../components/bubble";

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
        <div className="tab tab5">
            <div className="shortcut-lists">
                {shortcuts.map((shortcut) =>
                    shortcut.description?.length ? (
                        <div
                            className="refresher-shortcut"
                            key={shortcut.name}
                        >
                            <p className="description">{shortcut.description}</p>
                            <div className="key">
                                <Bubble text={shortcut.shortcut || "없음"}/>
                            </div>
                        </div>
                    ) : null
                )}
            </div>
            <p className="shortcut-settings-link"><a onClick={openShortcutSettings}>단축키 설정</a></p>
        </div>
    );
}

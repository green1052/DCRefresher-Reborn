import type {Browser} from "#imports";
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
        <div className="col" style={{gap: 12, paddingTop: 16}}>
            {shortcuts.map((shortcut) =>
                shortcut.description?.length ? (
                    <div className="card" key={shortcut.name}>
                        <div className="row" style={{gap: 12, justifyContent: "space-between"}}>
                            <div style={{fontSize: 13}}>{shortcut.description}</div>
                            <span className="badge">{shortcut.shortcut || "없음"}</span>
                        </div>
                    </div>
                ) : null
            )}

            <button
                className="btn btn-soft"
                onClick={openShortcutSettings}
                style={{alignSelf: "flex-start"}}
            >
                단축키 설정
            </button>
        </div>
    );
}

import {ExternalLink} from "lucide-react";
import {useEffect, useState} from "react";

import {Button} from "@/components/ui/button";
import {Kbd} from "@/components/ui/kbd";

import {Section} from "./Layout";

export function ShortcutTab() {
    const [shortcuts, setShortcuts] = useState<Browser.commands.Command[]>([]);

    useEffect(() => {
        // 단축키를 못 읽으면(등록 전 창 등) 빈 목록 그대로 둔다.
        const load = (): void => void browser.commands.getAll().then(setShortcuts, console.error);
        load();
        // 단축키 변경 이벤트가 없으므로 브라우저 설정에서 바꾸고 돌아올 때(focus) 다시 읽는다.
        window.addEventListener("focus", load);
        return () => window.removeEventListener("focus", load);
    }, []);

    return (
        <Section
            desc="단축키는 브라우저의 확장 프로그램 단축키 설정에서 변경할 수 있습니다."
            actions={
                <Button
                    variant="secondary"
                    onClick={() =>
                        // Firefox는 tabs.create로 about:addons를 열 수 없어 전용 API(137+)를 쓴다.
                        void (import.meta.env.BROWSER === "firefox"
                            // @ts-ignore 파이어폭스 전용 API라 크롬 기준 타입(wxt/browser)에 없다.
                            ? browser.commands.openShortcutSettings()
                            : browser.tabs.create({url: "chrome://extensions/shortcuts"}))
                    }
                >
                    <ExternalLink data-icon="inline-start"/> 단축키 설정
                </Button>
            }
        >
            <div className="flex flex-col divide-y">
                {shortcuts
                    .filter((shortcut) => shortcut.description)
                    .map((shortcut) => (
                        <div key={shortcut.name} className="flex items-center justify-between gap-3 py-3">
                            <span>{shortcut.description}</span>
                            {shortcut.shortcut ? <Kbd>{shortcut.shortcut}</Kbd> : <span className="text-muted-foreground">없음</span>}
                        </div>
                    ))}
            </div>
        </Section>
    );
}

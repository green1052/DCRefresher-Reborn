import {Button, Flex, Kbd, Separator, Text} from "@radix-ui/themes";
import {ExternalLink} from "lucide-react";
import {Fragment, useEffect, useState} from "react";

import {Section} from "./Layout";

export function ShortcutTab() {
    const [shortcuts, setShortcuts] = useState<Browser.commands.Command[]>([]);

    useEffect(() => {
        const load = (): void => void browser.commands.getAll().then(setShortcuts);
        load();
        // 단축키 변경 이벤트가 없으므로 브라우저 설정에서 바꾸고 돌아올 때(focus) 다시 읽는다
        window.addEventListener("focus", load);
        return () => window.removeEventListener("focus", load);
    }, []);

    return (
        // 파이어폭스는 확장이 about:addons를 열 수 없다 (tabs.create가 권한 about: 주소를 막는다). 크롬 타입에 없는 전용 API 대신 위치를 안내한다
        <Section
            desc={import.meta.env.FIREFOX
                ? "단축키는 about:addons의 톱니바퀴 메뉴 → '확장 기능 단축키 관리'에서 변경할 수 있습니다."
                : "단축키는 브라우저의 확장 프로그램 단축키 설정에서 변경할 수 있습니다."}
            actions={import.meta.env.FIREFOX ? undefined : (
                <Button variant="soft" onClick={() => void browser.tabs.create({url: "chrome://extensions/shortcuts"})}>
                    <ExternalLink size={14}/> 단축키 설정
                </Button>
            )}
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

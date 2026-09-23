import * as Switch from "@radix-ui/react-switch";
import {useEffect, useRef} from "react";

import {useAppContext} from "../../popup/context";

interface Props {
    name: string;
    desc: string;
    enabled: boolean;
}

export default function ModuleCard({name, desc, enabled}: Props) {
    const {settings, highlightModule, dismissHighlightModule} = useAppContext();
    const rootRef = useRef<HTMLDivElement>(null);
    const highlighted = highlightModule === name;

    // 일반 탭에서 이 모듈이 선택되면 모듈 탭이 새로 마운트되므로 여기서 1회 스크롤+강조.
    useEffect(() => {
        if (!highlighted) return;
        rootRef.current?.scrollIntoView({behavior: "smooth", block: "center"});
        const timer = setTimeout(dismissHighlightModule, 1000);
        return () => clearTimeout(timer);
    }, [highlighted]);

    return (
        <div
            className="card"
            ref={rootRef}
            style={highlighted ? {outline: "2px solid var(--accent)"} : undefined}
        >
            <div className="row" style={{gap: 12, justifyContent: "space-between"}}>
                <div>
                    <div className="heading">{name}</div>
                    <div className="text-muted">{desc}</div>
                </div>
                <Switch.Root
                    checked={enabled}
                    className="switch"
                    onCheckedChange={(value) => void settings.updateModuleStatus(name, value)}
                >
                    <Switch.Thumb className="switch-thumb"/>
                </Switch.Root>
            </div>
        </div>
    );
}

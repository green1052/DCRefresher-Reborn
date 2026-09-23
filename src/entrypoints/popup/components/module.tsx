import {useEffect, useRef} from "react";

import Checkbox from "./checkbox";
import {useAppContext} from "../context";

import "./module.scss";

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

    const handleToggle = async (value: boolean) => {
        try {
            await settings.updateModuleStatus(name, value);
        } catch (error) {
            console.error("Failed to update module status:", error);
        }
    };

    return (
        <div
            className={highlighted ? "refresher-module highlight" : "refresher-module"}
            ref={rootRef}
        >
            <div className="left">
                <p className="title">
                    {name}
                </p>
                <p className="desc">
                    {desc}
                </p>
            </div>
            <div className="right">
                <Checkbox
                    onChange={(value) => void handleToggle(value)}
                    value={enabled}
                />
            </div>
        </div>
    );
}

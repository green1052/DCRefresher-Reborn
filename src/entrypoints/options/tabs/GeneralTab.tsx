import {ChevronRight} from "lucide-react";

import iconUrl from "@/assets/icon.png";
import {useAppContext} from "../../popup/context";
import SettingItem from "../components/SettingItem";

const links = [
    {text: "GitHub", url: "https://github.com/green1052/DCRefresher-Reborn"},
    {text: "갤러리", url: "https://gall.dcinside.com/mini/board/lists/?id=bjwg64"},
    {text: "Discord", url: "https://discord.gg/SSW6Zuyjz6"},
    {text: "후원", url: "https://www.buymeacoffee.com/green1052"},
    {text: "도움말", url: "https://dcrefresher.green1052.com"}
];

export default function GeneralTab() {
    const {settings, moveToModuleTab} = useAppContext();
    const {modules, settings: moduleSettings, hasSettings, modulesWithBasicSettings} = settings;

    const version = import.meta.env.DEV
        ? `${browser.runtime.getManifest().version}-dev`
        : browser.runtime.getManifest().version;

    return (
        <div className="col" style={{gap: 16, paddingTop: 16}}>
            <div className="card">
                <div className="row" style={{gap: 16}}>
                    <img
                        height={64}
                        src={iconUrl}
                        width={64}
                    />
                    <div>
                        <div className="heading" style={{fontSize: 16}}>DCRefresher Reborn</div>
                        <div className="text-muted">v{version}</div>
                        <div className="row" style={{gap: 12, marginTop: 4}}>
                            {links.map((link) => (
                                <a
                                    className="link"
                                    href={link.url}
                                    key={link.url}
                                    target="_blank"
                                >
                                    {link.text}
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {!hasSettings ? (
                <div className="callout">우선 디시인사이드 페이지를 열고 설정 해주세요.</div>
            ) : (
                modulesWithBasicSettings.map((moduleName) => (
                    <div className="card" key={moduleName}>
                        <div
                            className="row"
                            onClick={() => moveToModuleTab(moduleName)}
                            style={{cursor: "pointer", gap: 4, marginBottom: 8}}
                        >
                            <div className="heading">
                                {moduleName}
                                {modules[moduleName]?.enable ? "" : " (비활성화)"}
                            </div>
                            <ChevronRight size={16}/>
                        </div>

                        <div className="col">
                            {Object.keys(moduleSettings[moduleName] ?? {}).map((settingKey) => (
                                <SettingItem
                                    key={`${moduleName}-${settingKey}`}
                                    moduleEnabled={modules[moduleName]?.enable ?? false}
                                    moduleName={moduleName}
                                    setting={(moduleSettings[moduleName] ?? {})[settingKey]!}
                                    settingKey={settingKey}
                                />
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

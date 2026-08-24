import {ChevronRight} from "lucide-react";

import SettingItem from "./settingItem";
import {useAppContext} from "../context";

interface Props {
    moduleName: string;
    moduleSettings: Record<string, RefresherSettings>;
    moduleEnabled: boolean;
}

export default function SettingsModule({moduleName, moduleSettings, moduleEnabled}: Props) {
    const {moveToModuleTab} = useAppContext();

    return (
        <div className="refresher-setting-category">
            <h3 onClick={() => moveToModuleTab(moduleName)}>
                {moduleName} {moduleEnabled ? "" : "(비활성화)"}
                <ChevronRight size={18}/>
            </h3>

            {Object.keys(moduleSettings).map((settingKey) => (
                <SettingItem
                    key={`${moduleName}-${settingKey}`}
                    moduleEnabled={moduleEnabled}
                    moduleName={moduleName}
                    setting={moduleSettings[settingKey]}
                    settingKey={settingKey}
                />
            ))}
        </div>
    );
}

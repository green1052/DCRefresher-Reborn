import SettingControl from "./settingControl";
import {useAppContext} from "../context";

interface Props {
    setting: RefresherSettings;
    settingKey: string;
    moduleName: string;
    moduleEnabled: boolean;
}

export default function SettingItem({setting, settingKey, moduleName, moduleEnabled}: Props) {
    const {settings} = useAppContext();

    return (
        <div
            className="refresher-setting"
            data-changed={setting.value !== setting.default}
        >
            <div className="info">
                <h4>{setting.name}</h4>
                <p>{setting.desc}</p>
                <p className="mute">(기본 값 : {String(settings.typeWrap(setting.default))})</p>
            </div>

            <SettingControl
                moduleEnabled={moduleEnabled}
                moduleName={moduleName}
                setting={setting}
                settingKey={settingKey}
            />
        </div>
    );
}

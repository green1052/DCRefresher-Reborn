import Checkbox from "./checkbox";
import Options from "./options";
import Range from "./range";
import RefresherInput from "./refresherInput";
import {useAppContext} from "../context";

interface Props {
    setting: RefresherSettings;
    settingKey: string;
    moduleName: string;
    moduleEnabled: boolean;
}

export default function SettingControl({setting, settingKey, moduleName, moduleEnabled}: Props) {
    const {settings} = useAppContext();

    const onChange = (value: unknown) => {
        void settings.updateUserSetting(moduleName, settingKey, value);
    };

    return (
        <div className="control">
            {setting.type === "check" && (
                <Checkbox
                    disabled={!moduleEnabled}
                    onChange={onChange}
                    value={Boolean(setting.value)}
                />
            )}
            {setting.type === "text" && (
                <RefresherInput
                    disabled={!moduleEnabled}
                    onChange={onChange}
                    placeholder={setting.default as string | undefined}
                    value={String(setting.value ?? "")}
                />
            )}
            {setting.type === "range" && (
                <Range
                    disabled={!moduleEnabled}
                    max={setting.max}
                    min={setting.min}
                    onChange={onChange}
                    placeholder={String(setting.default)}
                    step={setting.step}
                    unit={setting.unit}
                    value={Number(setting.value)}
                />
            )}
            {setting.type === "option" && (
                <Options
                    disabled={!moduleEnabled}
                    onChange={onChange}
                    options={setting.items as Record<string, string>}
                    value={String(setting.value ?? "")}
                />
            )}
        </div>
    );
}

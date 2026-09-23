import {Switch} from "radix-ui";

import {useAppContext} from "../../popup/context";

interface Props {
    setting: RefresherSettings;
    settingKey: string;
    moduleName: string;
    moduleEnabled: boolean;
}

const CONTROL_WIDTH = 220;

export default function SettingItem({setting, settingKey, moduleName, moduleEnabled}: Props) {
    const {settings} = useAppContext();

    const onChange = (value: unknown) => {
        void settings.updateUserSetting(moduleName, settingKey, value);
    };

    return (
        <div className="setting-row">
            <div className="setting-labels">
                <div style={{fontSize: 13, fontWeight: 500}}>{setting.name}</div>
                <div className="text-muted">{setting.desc}</div>
                <div className="text-muted">
                    (기본 값 : {String(settings.typeWrap(setting.default))})
                </div>
            </div>

            {setting.type === "check" && (
                <Switch.Root
                    checked={Boolean(setting.value)}
                    className="switch"
                    disabled={!moduleEnabled}
                    onCheckedChange={onChange}
                >
                    <Switch.Thumb className="switch-thumb"/>
                </Switch.Root>
            )}
            {setting.type === "text" && (
                <input
                    className="input"
                    disabled={!moduleEnabled}
                    onChange={(ev) => onChange(ev.target.value)}
                    placeholder={setting.default}
                    style={{width: CONTROL_WIDTH}}
                    value={String(setting.value ?? "")}
                />
            )}
            {setting.type === "range" && (
                <div className="row" style={{gap: 8}}>
                    <input
                        disabled={!moduleEnabled}
                        max={setting.max}
                        min={setting.min}
                        onChange={(ev) => onChange(Number(ev.target.value))}
                        step={setting.step}
                        style={{width: CONTROL_WIDTH - 48}}
                        type="range"
                        value={Number(setting.value)}
                    />
                    <div className="text-muted" style={{width: 44}}>
                        {Number(setting.value)}{setting.unit}
                    </div>
                </div>
            )}
            {setting.type === "option" && (
                <select
                    className="native-select"
                    disabled={!moduleEnabled}
                    onChange={(ev) => onChange(ev.target.value)}
                    style={{width: CONTROL_WIDTH}}
                    value={String(setting.value ?? "")}
                >
                    {Object.entries(setting.items).map(([key, label]) => (
                        <option key={key} value={key}>
                            {label}
                        </option>
                    ))}
                </select>
            )}
        </div>
    );
}

import * as Select from "@radix-ui/react-select";
import * as Switch from "@radix-ui/react-switch";

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
                <Select.Root
                    disabled={!moduleEnabled}
                    onValueChange={onChange}
                    value={String(setting.value ?? "")}
                >
                    <Select.Trigger
                        aria-label={setting.name}
                        className="select-trigger"
                        style={{width: CONTROL_WIDTH}}
                    >
                        <Select.Value/>
                    </Select.Trigger>
                    <Select.Portal>
                        <Select.Content className="select-content">
                            <Select.Viewport className="select-viewport">
                                {Object.entries(setting.items).map(([key, label]) => (
                                    <Select.Item className="select-item" key={key} value={key}>
                                        {label}
                                    </Select.Item>
                                ))}
                            </Select.Viewport>
                        </Select.Content>
                    </Select.Portal>
                </Select.Root>
            )}
        </div>
    );
}

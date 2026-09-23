import {Box, Flex, Select, Slider, Switch, Text, TextField} from "@radix-ui/themes";

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
        <Flex align="center" gap="4" justify="between" py="2">
            <Box style={{maxWidth: "60%"}}>
                <Text as="div" size="2" weight="medium">{setting.name}</Text>
                <Text as="div" color="gray" size="1">{setting.desc}</Text>
                <Text as="div" color="gray" size="1">
                    (기본 값 : {String(settings.typeWrap(setting.default))})
                </Text>
            </Box>

            {setting.type === "check" && (
                <Switch
                    checked={Boolean(setting.value)}
                    disabled={!moduleEnabled}
                    onCheckedChange={onChange}
                />
            )}
            {setting.type === "text" && (
                <TextField.Root
                    disabled={!moduleEnabled}
                    onChange={(ev) => onChange(ev.target.value)}
                    placeholder={setting.default}
                    size="2"
                    style={{width: CONTROL_WIDTH}}
                    value={String(setting.value ?? "")}
                />
            )}
            {setting.type === "range" && (
                <Flex align="center" gap="2">
                    <Slider
                        disabled={!moduleEnabled}
                        max={setting.max}
                        min={setting.min}
                        onValueChange={(value) => onChange(value[0])}
                        step={setting.step}
                        style={{width: CONTROL_WIDTH - 48}}
                        value={[Number(setting.value)]}
                    />
                    <Text color="gray" size="1" style={{width: 44}}>
                        {Number(setting.value)}{setting.unit}
                    </Text>
                </Flex>
            )}
            {setting.type === "option" && (
                <Select.Root
                    disabled={!moduleEnabled}
                    onValueChange={onChange}
                    size="2"
                    value={String(setting.value ?? "")}
                >
                    <Select.Trigger style={{width: CONTROL_WIDTH}}/>
                    <Select.Content>
                        {Object.entries(setting.items).map(([key, label]) => (
                            <Select.Item key={key} value={key}>
                                {label}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
            )}
        </Flex>
    );
}

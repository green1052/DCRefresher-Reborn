import {Box} from "@radix-ui/themes";

import {SettingItem} from "@/components/SettingItem";
import {useModulesStore} from "@/stores/modules";

import {Empty, Section} from "./Layout";

export function GeneralTab() {
    const schemas = useModulesStore((state) => state.schemas);
    const unavailable = useModulesStore((state) => state.unavailable);
    const tabId = useModulesStore((state) => state.tabId);
    const changeSetting = useModulesStore((state) => state.changeSetting);

    return (
        <Box>
            {unavailable && <Empty>우선 디시인사이드 페이지를 열고 설정해주세요.</Empty>}

            {schemas.map((schema) => {
                if (!schema.settings) return null;

                return (
                    <Section key={schema.id} title={schema.name}>
                        {Object.entries(schema.settings).map(([key, settingSchema]) => (
                            <SettingItem
                                key={key}
                                schema={settingSchema}
                                value={schema.values?.[key] ?? settingSchema.default}
                                disabled={!schema.enable}
                                onChange={(value) => void changeSetting(schema.id, key, value, tabId)}
                            />
                        ))}
                    </Section>
                );
            })}
        </Box>
    );
}

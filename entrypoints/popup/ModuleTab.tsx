import {Switch} from "radix-ui";

import {SettingItem} from "@/components/SettingItem";
import {useModulesStore} from "@/stores/modules";

export function ModuleTab() {
    const schemas = useModulesStore((state) => state.schemas);
    const unavailable = useModulesStore((state) => state.unavailable);
    const tabId = useModulesStore((state) => state.tabId);
    const toggle = useModulesStore((state) => state.toggle);
    const changeSetting = useModulesStore((state) => state.changeSetting);

    if (unavailable) return <div className="empty">디시인사이드 탭을 열어주세요.</div>;

    if (schemas.length === 0) return <div className="empty">모듈이 없습니다.</div>;

    return (
        <div>
            {schemas.map((schema) => (
                <section key={schema.id} className="dcr-section">
                    <header className="dcr-section-head">
                        <div className="dcr-module-text">
                            <div className="dcr-module-name">{schema.name}</div>
                            <div className="dcr-module-desc">{schema.description}</div>
                        </div>
                        <Switch.Root
                            className="dcr-switch-root"
                            checked={schema.enable}
                            onCheckedChange={(value) => void toggle(schema.id, value, tabId)}
                        >
                            <Switch.Thumb className="dcr-switch-thumb" />
                        </Switch.Root>
                    </header>

                    {schema.settings &&
                        Object.entries(schema.settings).map(([key, settingSchema]) => (
                            <SettingItem
                                key={key}
                                schema={settingSchema}
                                value={schema.values?.[key] ?? settingSchema.default}
                                disabled={!schema.enable}
                                onChange={(value) => void changeSetting(schema.id, key, value, tabId)}
                            />
                        ))}
                </section>
            ))}
        </div>
    );
}

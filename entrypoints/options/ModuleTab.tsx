import {Switch} from "@radix-ui/themes";

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
                <section key={schema.id} className="refresher-section">
                    <header className="refresher-section-head">
                        <div className="refresher-module-text">
                            <div className="refresher-module-name">{schema.name}</div>
                            <div className="refresher-module-desc">{schema.description}</div>
                        </div>
                        <Switch
                            size="1"
                            checked={schema.enable}
                            onCheckedChange={(value) => void toggle(schema.id, value, tabId)}
                        />
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

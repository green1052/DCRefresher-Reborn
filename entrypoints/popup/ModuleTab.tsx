import {Switch} from "radix-ui";

import {useModulesStore} from "@/stores/modules";

export function ModuleTab() {
    const schemas = useModulesStore((state) => state.schemas);
    const unavailable = useModulesStore((state) => state.unavailable);
    const toggle = useModulesStore((state) => state.toggle);

    if (unavailable) return <div className="empty">디시인사이드 탭을 열어주세요.</div>;

    if (schemas.length === 0) return <div className="empty">모듈이 없습니다.</div>;

    return (
        <div>
            {schemas.map((schema) => (
                <div key={schema.id} className="dcr-module-row">
                    <div className="dcr-module-text">
                        <div className="dcr-module-name">{schema.name}</div>
                        <div className="dcr-module-desc">{schema.description}</div>
                    </div>
                    <Switch.Root
                        className="dcr-switch-root"
                        checked={schema.enable}
                        onCheckedChange={(value) => void toggle(schema.id, value)}
                    >
                        <Switch.Thumb className="dcr-switch-thumb" />
                    </Switch.Root>
                </div>
            ))}
        </div>
    );
}

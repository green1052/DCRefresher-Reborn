import {useAppContext} from "../../popup/context";
import ModuleCard from "../components/ModuleCard";

export default function ModuleTab() {
    const {settings} = useAppContext();
    const {modules, hasModules} = settings;

    return (
        <div className="col" style={{gap: 12, paddingTop: 16}}>
            {!hasModules ? (
                <div className="callout">우선 디시 페이지를 열어주세요.</div>
            ) : (
                Object.values(modules).map((module) => (
                    <ModuleCard
                        desc={module.description ?? ""}
                        enabled={module.enable}
                        key={module.name}
                        name={module.name}
                    />
                ))
            )}
        </div>
    );
}

import ModuleCard from "../components/module";
import {useAppContext} from "../context";

export default function ModuleTab() {
    const {settings} = useAppContext();
    const {modules, hasModules} = settings;

    return (
        <div className="tab tab4">
            {!hasModules ? (
                <div className="refresher-no-modules">
                    <h3>로드된 모듈 없음</h3>
                    <p>우선 디시 페이지를 열어주세요.</p>
                </div>
            ) : (
                <div>
                    {Object.values(modules).map((module) => (
                        <ModuleCard
                            desc={module.description ?? ""}
                            enabled={module.enable}
                            key={module.name}
                            name={module.name}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

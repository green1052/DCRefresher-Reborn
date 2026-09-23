import {Callout, Flex} from "@radix-ui/themes";

import {useAppContext} from "../../popup/context";
import ModuleCard from "../components/ModuleCard";

export default function ModuleTab() {
    const {settings} = useAppContext();
    const {modules, hasModules} = settings;

    return (
        <Flex direction="column" gap="3" pt="4">
            {!hasModules ? (
                <Callout.Root color="gray">
                    <Callout.Text>우선 디시 페이지를 열어주세요.</Callout.Text>
                </Callout.Root>
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
        </Flex>
    );
}

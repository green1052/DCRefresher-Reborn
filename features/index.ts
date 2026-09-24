import type {ModuleDefinition} from "@/core/module/types";

const modules = import.meta.glob<{default: ModuleDefinition}>("./*/index.ts", {eager: true});

const features: ModuleDefinition[] = Object.values(modules)
    .map((module) => module.default)
    .filter((module): module is ModuleDefinition => Boolean(module?.id));

export default features;

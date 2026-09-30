import type {AnyModule} from "@/core/module/types";

const modules = import.meta.glob<{ default: AnyModule }>("./*/index.ts", {eager: true});

const features: AnyModule[] = Object.values(modules)
    .map((module) => module.default);

export default features;

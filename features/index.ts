import type {ModuleDefinition} from "@/core/module/types";

import blockModule from "@/features/block";
import refreshModule from "@/features/refresh";

const features: ModuleDefinition[] = [blockModule, refreshModule];

export default features;

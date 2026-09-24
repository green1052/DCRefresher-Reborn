import type {ModuleDefinition} from "@/core/module/types";

import blockModule from "@/features/block";
import fontsModule from "@/features/fonts";
import imagesearchModule from "@/features/imagesearch";
import layoutModule from "@/features/layout";
import manageModule from "@/features/manage";
import refreshModule from "@/features/refresh";
import stealthModule from "@/features/stealth";
import userinfoModule from "@/features/userinfo";
import writeModule from "@/features/write";

const features: ModuleDefinition[] = [
    blockModule,
    fontsModule,
    imagesearchModule,
    layoutModule,
    manageModule,
    refreshModule,
    stealthModule,
    userinfoModule,
    writeModule
];

export default features;

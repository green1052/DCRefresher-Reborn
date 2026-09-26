import Emittery from "emittery";

import type {ModuleEventData} from "./types";

export const eventBus = new Emittery<ModuleEventData>();

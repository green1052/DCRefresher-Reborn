import {defineModuleMeta} from "@/core/module/define";
import {BOARD_PAGE} from "@/core/pages";

export default defineModuleMeta({
    id: "manage",
    urls: [BOARD_PAGE],
    defaultEnable: false,

    settings: {
        checkAllTargetUser: {type: "check", default: false},
        checkViaShift: {type: "check", default: false},
        checkCommentViaCtrl: {type: "check", default: false},
        deleteViaCtrl: {type: "check", default: false},
        enableGifControl: {type: "check", default: false},
        imageOrigin: {type: "check", default: false},
        titleSearch: {type: "check", default: false}
    }
});

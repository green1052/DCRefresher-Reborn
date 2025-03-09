import type { Nullable } from "../utils/types";
import type { User } from "../utils/user";
import type Vue from "vue";

export {};

declare global {
    interface DcinsideDcconDetail {
        list: DcinsideDcconDetailList[];
        max_page: number;
        target: string;
    }

    interface DcinsideDcconDetailList {
        detail: DcinsideDccon[];
        detail_page: number;
        end_date: string;
        icon_cnt: number;
        main_img_url: string;
        package_idx: string;
        sort: string;
        title: string;
    }

    interface DcinsideDccon {
        detail_idx: string;
        list_img: string;
        package_idx: string;
        package_title: string;
        sort: string;
        title: string;
    }

    interface DcinsideCommentObject {
        a_my_cmt: "Y" | "N";
        c_no: 0 | string;
        del_btn: "Y" | "N";
        del_yn: "Y" | "N";
        depth: 0 | 1;
        gallog_icon: string;
        ip: string;
        is_delete: string;
        memo: string;
        mod_btn: "Y" | "N";
        my_cmt: "Y" | "N";
        name: string;
        nicktype?: string;
        nickname: string;
        no: string;
        parent: string;
        password_pop: string;
        rcnt: string;
        reg_date: string;
        reply_w: "Y" | "N";
        t_ch1: string;
        t_ch2: string;
        user_id: string;
        voice: string | null;
        vr_player: boolean | string;
        vr_player_tag: string;
        vr_type: string;
        user: User;
    }

    interface DcinsideComments {
        comments: Nullable<DcinsideCommentObject[]>;
        total_cnt: number;
    }

    interface RefresherFrameAppVue extends Vue {
        changeStamp: () => void;
        first: () => RefresherFrame;
        second: () => RefresherFrame;
        clearScrollMode: () => void;
        outerClick: () => void;
        close: () => void;
        fadeIn: () => void;
        fadeOut: () => void;
        frames: RefresherFrame[];
        closed: boolean;
        inputFocus: boolean;
    }
}

import type Vue from "vue";
import type { Nullable } from "../utils/types";

export {};

declare global {
    interface DcinsideDcconDetail {
        list: {
            detail: DcinsideDccon[];
            detail_page: number;
            end_date: string;
            icon_cnt: number;
            main_img_url: string;
            package_idx: string;
            sort: string;
            title: string;
        }[];
        max_page: number;
        target: string;
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
        del_btn: "Y" | "N";
        no: string;
        parent: string;
        name: string;
        ip: string;
        is_delete: "0" | "1";
        user_id: string;
        my_cmt: "Y" | "N";
        user: User;
        nicktype: string;
        memo: string;
        depth: number;
        vr_player: boolean | string;
        gallog_icon: string;
        vr_player_tag: string;
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
export {};

declare global {
    interface dcinsideCommentObject {
        del_btn: "Y" | "N";
        no: string
        parent: string
        name: string
        ip: string
        is_delete: "0" | "1"
        user_id: string
        my_cmt: "Y" | "N"
        user: User
        nicktype: string
        memo: string
        depth: number
        vr_player: boolean | string
        gallog_icon: string
        vr_player_tag: string
    }

    interface dcinsideComments {
        comments: dcinsideCommentObject[]
        total_cnt: number
    }

    interface RefresherFrameAppVue extends Vue {
        changeStamp: () => void

        first: () => RefresherFrame
        second: () => RefresherFrame
        clearScrollMode: () => void
        outerClick: () => void
        close: () => void
        fadeIn: () => void
        fadeOut: () => void

        frames: RefresherFrame[]

        closed: boolean
        inputFocus: boolean
    }
}
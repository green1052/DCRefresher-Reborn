export {};

declare global {
  interface dcinsideCommentObject {
    no: string
    parent: string
    name: string
    ip: string | null
    user_id: string | null
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
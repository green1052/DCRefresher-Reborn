export {};

declare global {
  interface miniPreview {
    element: HTMLDivElement
    init: boolean
    lastRequest: number
    controller: AbortController
    lastElement: EventTarget | null
    lastTimeout: number
    caches: { [index: string]: PostInfo }
    shouldOutHandle: boolean
    cursorOut: boolean

    create: (ev: MouseEvent, use: boolean) => void
    move: (ev: MouseEvent, use: boolean) => void
    close: (use: boolean) => void
  }

  interface refresherUserTypes {
    uid: string
    nick: string
    ip: string
  }

  interface refresherMemo {
    text: string
    color: string
  }
}
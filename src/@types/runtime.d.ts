export {};

declare global {
  interface RefresherRuntimeMessage {
    updateUserSetting?: boolean
    updateModuleSettings?: boolean
    name: string
    key?: string
    value: unknown
  }

  interface runtimeMessage {
    type: string
    data: unknown
  }
}
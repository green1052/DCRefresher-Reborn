export default {
    name: "자짤",
    description: "자짤 기능을 추가합니다.",
    url: /\/board\/(write|modify)/,
    status: {},
    memory: {},
    enable: true,
    default_enable: true,
    settings: {},
    require: ["filter"],
    func(filter) {},
    revoke(filter) {}
} as RefresherModule<{
    // settings: {};
    require: ["filter"];
}>;

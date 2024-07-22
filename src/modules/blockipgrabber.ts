import browser from "webextension-polyfill";

export default {
    name: "IP Grabber 방지",
    description: "IP 추출을 방지합니다.",
    status: {},
    enable: false,
    default_enable: false,
    settings: {
        blockImageGrabber: {
            name: "이미지 IP 추출 방지",
            desc: "이미지를 불러올 때 다른 서버로의 요청을 차단하여 IP 추출을 방지합니다.",
            type: "check",
            default: false
        }
    },
    update: {
        blockImageGrabber(value) {
            browser.runtime.sendMessage({requestRefresherBlockIPGrabber: true, enableBlockIPGrabber: value});
        }
    }
} as RefresherModule<{
    settings: {
        blockImageGrabber: RefresherCheckSettings;
    }
}>;
import browser from "webextension-polyfill";

export default {
    name: "IP Grabber 방지",
    description: "이미지를 통한 IP 추출을 방지합니다.",
    enable: false,
    default_enable: false,
    func() {
        console.log(1);
        browser.runtime.sendMessage({requestRefresherBlockIPGrabber: true, enableBlockIPGrabber: true});
    },
    revoke() {
        browser.runtime.sendMessage({requestRefresherBlockIPGrabber: true, enableBlockIPGrabber: false});
    }
} as RefresherModule;
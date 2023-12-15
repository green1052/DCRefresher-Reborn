import * as Toast from "../components/toast";
import {runtime} from "webextension-polyfill";

const inject = (filename: string) => {
    const scriptElement = document.createElement("script");
    scriptElement.src = runtime.getURL(filename);
    document.documentElement.appendChild(scriptElement);
};

export default {
    name: "알림 개선",
    description: "디시인사이드 알림을 더 미려하게 개선합니다.",
    enable: false,
    default_enable: false,
    func() {
        inject("../assets/js/alert_register.js");

        window.addEventListener(
            "message",
            (event) => {
                if (event.source !== window) {
                    return;
                }

                if (event.data.type && event.data.type === "ALERT") {
                    Toast.show(event.data.text, false, 2600);
                }
            },
            false
        );
    },
    revoke() {
        inject("../assets/js/alert_unregister.js");
    }
} as RefresherModule;
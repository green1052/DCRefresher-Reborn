import * as Toast from "../components/toast";
import { inject } from "../utils/inject";

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
                if (event.source === window && event.data?.type === "refresherAlert")
                    Toast.show(event.data.message, false, 2500);
            },
            false
        );
    },
    revoke() {
        inject("../assets/js/alert_unregister.js");
    }
} as RefresherModule;

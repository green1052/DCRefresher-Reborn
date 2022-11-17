import browser from "webextension-polyfill";
import * as Toast from "../components/toast";
import storage from "../utils/storage";

setTimeout(async () => {
    const currentVersion = browser.runtime.getManifest().version;
    const key = await storage.get("refresher.lastVersion");

    if (currentVersion && (!key || key !== currentVersion)) {
        Toast.show(
            `DCRefresher Reborn이 ${currentVersion}(으)로 업데이트되었습니다. 변경 사항은 여기에서 볼 수 있습니다.`,
            false,
            4000,
            () => {
                window.open(
                    `https://github.com/green1052/DCRefresher-Reborn/releases/tag/${currentVersion}`,
                    "_blank"
                );
            }
        );

        storage.set("refresher.lastVersion", currentVersion);
    }
}, 5000);
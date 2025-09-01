import browser from "webextension-polyfill";

import storage from "../utils/storage";
import toast from "../utils/toast";

(async () => {
    const [installed, updated] = await Promise.all([
        storage.get<boolean>("refresher.firstInstall"),
        storage.get<boolean>("refresher.updated")
    ]);

    if (installed || updated)
        setTimeout(() => {
            const currentVersion = browser.runtime.getManifest().version;

            let content: string;

            if (installed) {
                content = `DCRefresher Reborn ${currentVersion}이 설치되었습니다, 오류 및 개선사항은 여기에서 알려주세요.`;
                storage.remove("refresher.firstInstall");
            } else {
                content = `DCRefresher Reborn이 ${currentVersion}(으)로 업데이트되었습니다, 변경 사항은 여기에서 볼 수 있습니다.`;
                storage.set("refresher.updated", false);
            }

            toast.show(content, "info", 5000, () =>
                window.open(`https://github.com/green1052/DCRefresher-Reborn/releases/tag/${currentVersion}`, "_blank")
            );
        }, 3000);
})();
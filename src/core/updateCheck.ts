import * as store from "./store";
import browser from "webextension-polyfill";
import * as http from "../utils/http";
import * as Toast from "../components/toast";

async function githubUpdateCheck(currentVersion: string) {
    const lastVersionCheck = await store.get("refresher.lastVersionCheck");
    const date = new Date().getTime();

    //12시간 지났는지 확인
    if (lastVersionCheck !== undefined && (new Date().getTime() - Number(lastVersionCheck)) / 1000 / 60 < 720) return;

    store.set("refresher.lastVersionCheck", date);

    const response = JSON.parse(await http.make("https://api.github.com/repos/green1052/DCRefresher-Reborn/releases"));

    const lastVersion = response[0].tag_name;

    if (!currentVersion || !lastVersion) return;

    if (lastVersion === currentVersion) return;

    Toast.show(
        `DCRefresher Reborn ${lastVersion}이 출시했습니다, 변경 사항은 여기에서 볼 수 있습니다.`,
        false,
        4000,
        () => {
            window.open(
                `https://github.com/green1052/DCRefresher-Reborn/releases/tag/${lastVersion}`,
                "_blank"
            );
        }
    );
}

async function updateCheck(currentVersion: string) {
    const key = await store.get("refresher.lastVersion");

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

        store.set("refresher.lastVersion", currentVersion);
    }
}

setTimeout(async () => {
    const currentVersion =  browser.runtime.getManifest().version;

    if (!currentVersion) return;

    await updateCheck(currentVersion);
    await githubUpdateCheck(currentVersion);
}, 5000);
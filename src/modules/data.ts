import * as Toast from "../components/toast";
import storage from "../utils/storage";
import browser from "webextension-polyfill";

function copyToClipboard(text: string) {
    const tempElem = document.createElement("textarea");
    tempElem.value = text;
    document.body.appendChild(tempElem);
    tempElem.select();
    document.execCommand("copy");
    document.body.removeChild(tempElem);
}

export default {
    name: "데이터 관리",
    description: "데이터를 관리합니다.",
    enable: true,
    default_enable: true,
    settings: {
        backupCloud: {
            name: "클라우드 백업",
            desc: "클라우드에 데이터를 백업합니다.",
            type: "check",
            default: false,
            advanced: true
        },
        recoverCloud: {
            name: "클라우드 복원",
            desc: "클라우드에서 데이터를 복원합니다.",
            type: "check",
            default: false,
            advanced: true
        },
        exportData: {
            name: "데이터 내보내기",
            desc: "데이터를 내보냅니다.",
            type: "check",
            default: false,
            advanced: true
        },
        importData: {
            name: "데이터 가져오기",
            desc: "데이터를 가져옵니다.",
            type: "check",
            default: false,
            advanced: true
        },
        clearData: {
            name: "⚠️데이터 초기화⚠️",
            desc: "데이터를 초기화합니다.",
            type: "check",
            default: false,
            advanced: true
        }
    },
    update: {
        backupCloud(this, _) {
            storage.get<Record<any, any>>().then(async (data) => {
                try {
                    delete data["refresher.database.ip"];
                    delete data["refresher.database.ban"];
                    delete data["refresher.database.version"];
                    delete data["refresher.database.lastUpdate"];

                    await browser.storage.sync.clear();
                    browser.storage.sync.set(data);

                    Toast.show("데이터를 클라우드에 백업했습니다.", false, 3000);
                } catch {
                    Toast.show("데이터를 클라우드에 백업하는데 실패했습니다.", true, 3000);
                }
            });
        },
        recoverCloud(this, _) {
            if (!confirm("ㄹ?ㅇ")) return;

            browser.storage.sync.get().then(async (data) => {
                try {
                    await storage.clear();

                    storage.setObject(data);
                    Toast.show("데이터를 복원했습니다.", false, 3000);
                } catch {
                    Toast.show("데이터를 복원하는데 실패했습니다.", true, 3000);
                }
            });
        },
        exportData(this, _) {
            storage.get<Record<any, any>>().then((data) => {
                delete data["refresher.database.ip"];
                delete data["refresher.database.ban"];
                delete data["refresher.database.version"];
                delete data["refresher.database.lastUpdate"];

                try {
                    copyToClipboard(JSON.stringify(data));
                    Toast.show("데이터를 클립보드로 내보냈습니다.", false, 3000);
                } catch {
                    Toast.show("데이터를 클립보드로 내보내는데 실패했습니다.", true, 3000);
                }
            });
        },

        importData(this, _) {
            const input = prompt("데이터를 입력해주세요.");

            if (!input) return;

            try {
                const data: Record<any, any> = JSON.parse(input);

                storage
                    .clear()
                    .then(() => {
                        storage.setObject(data);
                        Toast.show("데이터를 가져왔습니다.", false, 3000);
                    })
                    .catch(() => {
                        Toast.show("데이터를 가져오는데 실패했습니다.", true, 3000);
                    });
            } catch {
                Toast.show("데이터를 가져오는데 실패했습니다.", true, 3000);
            }
        },
        clearData(this, _) {
            if (!confirm("ㄹ?ㅇ")) return;

            storage.clear();
            Toast.show("데이터를 초기화했습니다.", false, 3000);
        }
    }
} as RefresherModule<{
    settings: {
        backupCloud: RefresherCheckSettings;
        recoverCloud: RefresherCheckSettings;
        exportData: RefresherCheckSettings;
        importData: RefresherCheckSettings;
        clearData: RefresherCheckSettings;
    };
}>;

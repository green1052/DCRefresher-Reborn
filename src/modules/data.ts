import toast from "../components/toast";
import storage from "../utils/storage";

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
    status: {},
    data: {
        lastUpdate: -1
    },
    enable: true,
    default_enable: true,
    settings: {
        autoBackup: {
            name: "자동 백업",
            desc: "하루마다 자동으로 데이터를 클라우드에 백업합니다.",
            type: "check",
            default: false,
            advanced: true
        },
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

                    await chrome.storage.sync.clear();
                    await chrome.storage.sync.set(data);

                    toast.show("데이터를 클라우드에 백업했습니다.", false, 3000);
                } catch {
                    toast.show("데이터를 클라우드에 백업하는데 실패했습니다.", true, 3000);
                }
            });
        },
        recoverCloud(this, _) {
            if (!confirm("ㄹ?ㅇ")) return;

            chrome.storage.sync.get().then(async (data) => {
                try {
                    await storage.clear();
                    await storage.setObject(data);

                    toast.show("데이터를 복원했습니다.", false, 3000);
                } catch {
                    toast.show("데이터를 복원하는데 실패했습니다.", true, 3000);
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
                    toast.show("데이터를 클립보드로 내보냈습니다.", false, 3000);
                } catch {
                    toast.show("데이터를 클립보드로 내보내는데 실패했습니다.", true, 3000);
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
                        toast.show("데이터를 가져왔습니다.", false, 3000);
                    })
                    .catch(() => toast.show("데이터를 가져오는데 실패했습니다.", true, 3000));
            } catch {
                toast.show("데이터를 가져오는데 실패했습니다.", true, 3000);
            }
        },
        clearData(this, _) {
            if (!confirm("ㄹ?ㅇ")) return;

            storage
                .clear()
                .then(() => toast.show("데이터를 초기화했습니다.", false, 3000))
                .catch(() => toast.show("데이터를 초기화하는데 실패했습니다.", false, 3000));
        }
    },
    func() {
        if (!this.status.autoBackup) return;

        if (this.data.lastUpdate === -1) {
            this.update.backupCloud();
            this.data.lastUpdate = Date.now();
            return;
        }

        if (Date.now() - this.data.lastUpdate > 24 * 60 * 60 * 1000) {
            this.update.backupCloud();
            this.data.lastUpdate = Date.now();
        }
    }
} as RefresherModule<{
    data: {
        lastUpdate: number;
    };
    settings: {
        autoBackup: RefresherCheckSettings;
        backupCloud: RefresherCheckSettings;
        recoverCloud: RefresherCheckSettings;
        exportData: RefresherCheckSettings;
        importData: RefresherCheckSettings;
        clearData: RefresherCheckSettings;
    };
}>;

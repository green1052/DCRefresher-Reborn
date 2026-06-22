import {normalizeStorageData} from "../utils/storageMigration";
import toast from "../utils/toast";
import {writeClipboard} from "../utils/writeClipboard";

const replaceLocalStorage = async (data: Record<string, unknown>): Promise<void> => {
    const previousData = await browser.storage.local.get(null);

    try {
        await browser.storage.local.clear();
        await browser.storage.local.set(data);
    } catch (error) {
        await browser.storage.local.clear();
        await browser.storage.local.set(previousData);
        throw error;
    }
};

const reloadAfterDataChange = (message: string): void => {
    toast.show(message, "info", 1000);
    window.setTimeout(() => location.reload(), 500);
};

const parseStorageImport = (input: string): Record<string, unknown> => {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("가져오기 데이터는 JSON 객체여야 합니다.");
    }

    return parsed as Record<string, unknown>;
};

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
        async backupCloud(this, _) {
            try {
                const data = await browser.storage.local.get(null);
                delete data["refresher.database.ip"];
                delete data["refresher.database.ban"];
                delete data["refresher.database.version"];
                delete data["refresher.database.lastUpdate"];

                await browser.storage.sync.clear();
                await browser.storage.sync.set(data);

                const now = Date.now();
                this.data.lastUpdate = now;
                await browser.storage.local.set({"refresher.database.lastUpdate": now});
                toast.show("데이터를 클라우드에 백업했습니다.");
            } catch (error) {
                console.error("Cloud backup failed:", error);
                toast.show("데이터를 클라우드에 백업하는데 실패했습니다.", "error");
            }
        },
        recoverCloud(this, _) {
            if (!confirm("클라우드 백업으로 현재 설정을 교체할까요?")) return;

            browser.storage.sync.get().then(async (data) => {
                try {
                    const preserved = await browser.storage.local.get([
                        "refresher.database.ip",
                        "refresher.database.ban"
                    ]);

                    await replaceLocalStorage(normalizeStorageData({...data, ...preserved}));

                    reloadAfterDataChange("데이터를 복원했습니다. 페이지를 다시 불러옵니다.");
                } catch {
                    toast.show("데이터를 복원하는데 실패했습니다.", "error");
                }
            });
        },
        exportData(this, _) {
            browser.storage.local.get().then((data) => {
                delete data["refresher.database.ip"];
                delete data["refresher.database.ban"];
                delete data["refresher.database.version"];
                delete data["refresher.database.lastUpdate"];

                writeClipboard(JSON.stringify(data))
                    .then(() => toast.show("데이터를 클립보드로 내보냈습니다."))
                    .catch(() => toast.show("데이터를 클립보드로 내보내는데 실패했습니다.", "error"));
            });
        },
        importData(this, _) {
            (async () => {
                const input = prompt("데이터를 입력해주세요.");

                if (!input) return;

                try {
                    const data = normalizeStorageData(parseStorageImport(input));

                    await replaceLocalStorage(data);

                    reloadAfterDataChange("데이터를 가져왔습니다. 페이지를 다시 불러옵니다.");
                } catch {
                    toast.show("데이터를 가져오는데 실패했습니다.", "error");
                }
            })();
        },
        clearData(this, _) {
            if (!confirm("모든 설정과 사용자 데이터를 초기화할까요?")) return;

            browser.storage.local
                .clear()
                .then(() => reloadAfterDataChange("데이터를 초기화했습니다. 페이지를 다시 불러옵니다."))
                .catch(() => toast.show("데이터를 초기화하는데 실패했습니다.", "error"));
        }
    },
    async func() {
        if (!this.status.autoBackup) return;

        const stored = await browser.storage.local.get("refresher.database.lastUpdate");
        const lastUpdate = stored["refresher.database.lastUpdate"] ?? -1;

        if (lastUpdate === -1 || Date.now() - lastUpdate > 24 * 60 * 60 * 1000) {
            await this.update.backupCloud();
        } else {
            this.data.lastUpdate = lastUpdate;
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

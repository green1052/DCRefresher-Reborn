import {backupStorage, databaseStorage} from "@/storage/wxtStorage";
import {useCallback, useState} from "react";

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

const DATABASE_PREFIX = "refresher:database:";

// IP/차단 데이터베이스는 용량이 커서 백업/내보내기에서 제외한다
const getLocalDataWithoutDatabase = async (): Promise<Record<string, unknown>> => {
    const data = await browser.storage.local.get(null);
    for (const key of Object.keys(data)) {
        if (key.startsWith(DATABASE_PREFIX)) delete data[key];
    }
    return data;
};

const parseStorageImport = (input: string): Record<string, unknown> => {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("가져오기 데이터는 JSON 객체여야 합니다.");
    }

    return parsed as Record<string, unknown>;
};

export function useData() {
    const [lastUpdate, setLastUpdate] = useState(-1);
    const [loading, setLoading] = useState(false);

    const refreshLastUpdate = useCallback(async () => {
        setLastUpdate(await backupStorage.lastUpdate.getValue());
    }, []);

    const backupCloud = async (): Promise<void> => {
        setLoading(true);
        try {
            const data = await getLocalDataWithoutDatabase();

            await browser.storage.sync.clear();
            await browser.storage.sync.set(data);

            const now = Date.now();
            setLastUpdate(now);
            await backupStorage.lastUpdate.setValue(now);
            alert("데이터를 클라우드에 백업했습니다.");
        } catch (error) {
            console.error("Cloud backup failed:", error);
            alert("데이터를 클라우드에 백업하는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const recoverCloud = async (): Promise<void> => {
        if (!confirm("클라우드 백업으로 현재 설정을 교체할까요?")) return;

        setLoading(true);
        try {
            const [data, preservedIp, preservedBan] = await Promise.all([
                browser.storage.sync.get(),
                databaseStorage.ip.getValue(),
                databaseStorage.ban.getValue()
            ]);

            const preserved: Record<string, unknown> = {};
            if (preservedIp) preserved["refresher:database:ip"] = preservedIp;
            if (preservedBan) preserved["refresher:database:ban"] = preservedBan;

            await replaceLocalStorage({...data, ...preserved});
            alert("데이터를 복원했습니다. 새탭에서 디시인사이드를 열어주세요.");
        } catch {
            alert("데이터를 복원하는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const exportData = async (): Promise<void> => {
        setLoading(true);
        try {
            const data = await getLocalDataWithoutDatabase();

            await navigator.clipboard.writeText(JSON.stringify(data));
            alert("데이터를 클립보드로 내보냈습니다.");
        } catch {
            alert("데이터를 클립보드로 내보내는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const importData = async (): Promise<void> => {
        const input = prompt("데이터를 입력해주세요.");

        if (!input) return;

        setLoading(true);
        try {
            const data = parseStorageImport(input);
            await replaceLocalStorage(data);
            alert("데이터를 가져왔습니다. 새탭에서 디시인사이드를 열어주세요.");
        } catch {
            alert("데이터를 가져오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const clearData = async (): Promise<void> => {
        if (!confirm("모든 설정과 사용자 데이터를 초기화할까요?")) return;

        setLoading(true);
        try {
            await browser.storage.local.clear();
            alert("데이터를 초기화했습니다. 새탭에서 디시인사이드를 열어주세요.");
        } catch {
            alert("데이터를 초기화하는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return {
        lastUpdate,
        loading,
        refreshLastUpdate,
        backupCloud,
        recoverCloud,
        exportData,
        importData,
        clearData
    };
}

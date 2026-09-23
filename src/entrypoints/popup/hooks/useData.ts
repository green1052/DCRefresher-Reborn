import {backupStorage} from "@/storage/wxtStorage";
import {useCallback, useState} from "react";

const STORAGE_KEY_PREFIX = "refresher:";
const DATABASE_PREFIX = "refresher:database:";
const SYNC_KEY_PREFIX = "refresher:module:";

// clear+set 사이 watcher가 빈 값을 관찰하지 않도록 set 후 사라진 키만 제거한다.
const replaceLocalStorage = async (data: Record<string, unknown>): Promise<void> => {
    const previousData = await browser.storage.local.get(null);

    try {
        await browser.storage.local.set(data);
        const dataKeys = new Set(Object.keys(data));
        const removedKeys = Object.keys(previousData).filter((key) => !dataKeys.has(key));
        if (removedKeys.length > 0) {
            await browser.storage.local.remove(removedKeys);
        }
    } catch (error) {
        await replaceLocalStorage(previousData);
        throw error;
    }
};

// IP/차단 데이터베이스는 용량이 커서 백업/내보내기에서 제외한다
const getLocalDataWithoutDatabase = async (): Promise<Record<string, unknown>> => {
    const data = await browser.storage.local.get(null);
    for (const key of Object.keys(data)) {
        if (key.startsWith(DATABASE_PREFIX)) delete data[key];
    }
    return data;
};

// sync은 item당 8KB 제한이 있어 설정(enable/setting)만 다룬다.
// block/memo는 단일 키가 제한을 초과할 수 있고 module data는 탭에서 재수집된다.
const getSyncScopedData = (data: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
        Object.entries(data).filter(([key]) => key.startsWith(SYNC_KEY_PREFIX) && !key.endsWith(":data"))
    );

const parseStorageImport = (input: string): Record<string, unknown> => {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("가져오기 데이터는 JSON 객체여야 합니다.");
    }

    const valid = Object.entries(parsed as Record<string, unknown>).filter(([key]) =>
        key.startsWith(STORAGE_KEY_PREFIX)
    );
    if (valid.length === 0) {
        throw new Error("가져올 데이터가 없습니다.");
    }

    return Object.fromEntries(valid);
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
            const data = getSyncScopedData(await browser.storage.local.get(null));

            await browser.storage.sync.clear();
            await browser.storage.sync.set(data);

            const now = Date.now();
            setLastUpdate(now);
            await backupStorage.lastUpdate.setValue(now);
            alert("설정을 클라우드에 백업했습니다. (차단 목록·메모 제외)");
        } catch (error) {
            console.error("Cloud backup failed:", error);
            alert("데이터를 클라우드에 백업하는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const recoverCloud = async (): Promise<void> => {
        if (!confirm("클라우드 백업(설정)으로 현재 설정을 교체할까요? 차단 목록과 메모는 유지됩니다.")) return;

        setLoading(true);
        try {
            const data = getSyncScopedData(await browser.storage.sync.get());
            if (Object.keys(data).length === 0) {
                alert("클라우드에 백업된 설정이 없습니다.");
                return;
            }
            await browser.storage.local.set(data);
            alert("설정을 복원했습니다. 새탭에서 디시인사이드를 열어주세요.");
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

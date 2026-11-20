import { useState } from "preact/hooks";
import { type RefObject } from "preact";

import {focusPanel} from "@/components/useReturnFocus";
import {type BackupSlot, clearCloudBackups, collectLocalData, readBackupTargets, readCloudBackup, runBackup} from "@/core/backup";
import {sendMessage} from "@/core/messaging/protocol";
import {mergeBackup, parseImport, writeSettings} from "@/core/settings-transfer";
import {backupStorage} from "@/core/storage/items";
import {friendlyMessage} from "@/utils/error";

import {formatTime} from "../shared/format";
import {type Done, notify, notifyDone} from "../optionsStore";

export type RestoreMode = "replace" | "merge";

export function useDataActions(restoreRef: RefObject<HTMLButtonElement | null>, setRestoreOpen: (open: boolean) => void) {
    const [loading, setLoading] = useState(false);

    const run = async (action: () => Promise<Done>, failure: string): Promise<void> => {
        // 누른 버튼이 막히면 포커스가 body로 떨어져 알림을 닫은 뒤 돌아갈 곳이 없으므로 가까운 조상(탭 패널)로 옮겨 둔다.
        if (document.activeElement !== document.body) focusPanel(document.activeElement);
        setLoading(true);
        let done: Done | undefined;
        let failed = "";
        try {
            done = await action();
        } catch (e) {
            console.error(e);
            failed = `${failure} ${friendlyMessage(e)}`;
        }
        // 확인 창 안에서 부르면(초기화) 창이 닫히며 포커스가 body로 떨어지고, 실패 알림이 그 body를 돌아갈 곳으로 기억한다.
        if (document.activeElement === document.body) focusPanel(restoreRef.current);
        if (done) notifyDone(done);
        else notify(failed);
        setLoading(false);
    };

    const forceUpdate = () => run(() => sendMessage("refresher:updateDatabase").then(() => "데이터베이스를 갱신했습니다."), "데이터베이스를 갱신하지 못했습니다.");

    const backupCloud = () => run(() => runBackup("manual").then(() => "데이터를 클라우드에 백업했습니다."), "클라우드에 백업하지 못했습니다.");

    // 빈 설정을 쓰기 전에 자동 백업을 끈다. 켜 두면 1분 뒤 빈 설정이 클라우드 자동 백업을 덮는다.
    const pauseAutoForEmpty = async (data: Record<string, unknown>): Promise<boolean> => {
        if (Object.keys(data).length > 0 || !(await backupStorage.auto().getValue())) return false;
        await backupStorage.auto().setValue(false);
        return true;
    };

    // writeSettings가 남긴 직전 상태로 되돌린다 - 그 뒤 다른 작업이 칸을 덮었으면(at 불일치) 되돌리지 않는다.
    const revert = (at?: number, auto = false) =>
        run(async () => {
            const before = await backupStorage.undo().getValue();
            if (!before) return "되돌릴 데이터가 없습니다.";
            if (at !== undefined && before.createdAt !== at) return "그 뒤에 다른 작업이 있어 이 알림으로는 되돌릴 수 없습니다.";
            const off = await pauseAutoForEmpty(before.data);
            await writeSettings(before.data, "replace");
            if (auto) await backupStorage.auto().setValue(true);
            return `${formatTime(before.createdAt)} 직전 상태로 되돌렸습니다.${auto ? " 자동 백업도 다시 켰습니다." : off ? " 클라우드 백업을 지키려고 자동 백업을 껐습니다." : ""}`;
        }, "되돌리지 못했습니다.");

    // 직전 상태를 남기지 못했으면(at 없음) 되돌리기 버튼을 달지 않는다.
    const undoable = (message: string, at: number | undefined, auto = false): Done => (at === undefined ? message : {message, undo: () => void revert(at, auto)});

    const recoverCloud = (slot: BackupSlot, mode: RestoreMode) =>
        run(async () => {
            setRestoreOpen(false);
            const backup = await readCloudBackup(slot);
            if (!backup) return "클라우드에 백업이 없습니다.";

            const data = mode === "merge" ? mergeBackup(await readBackupTargets(), backup.data) : backup.data;
            const at = await writeSettings(data, mode);
            const what = `${formatTime(backup.createdAt)} 백업을`;
            return undoable(`${what} ${mode === "merge" ? "합쳤습니다" : "복원했습니다"}.`, at);
        }, "복원하지 못했습니다.");

    const toggleAutoBackup = async (on: boolean): Promise<void> => {
        try {
            await backupStorage.auto().setValue(on);
        } catch (e) {
            console.error(e);
            notify(`자동 백업 설정을 저장하지 못했습니다. ${friendlyMessage(e)}`);
            return;
        }
        // 켜는 순간의 설정을 자동 백업 칸에 바로 올린다. 이후에는 설정이 바뀔 때마다 백그라운드가 올린다.
        if (on) {
            await run(() => runBackup("auto").then(() => "자동 백업을 켰습니다. 지금 설정을 자동 백업으로 올렸습니다."), "자동 백업을 켰지만 첫 백업을 올리지 못했습니다.");
        }
    };

    const exportData = () =>
        run(
            () => collectLocalData().then((data) => navigator.clipboard.writeText(JSON.stringify(data))).then(() => "데이터를 클립보드로 내보냈습니다."),
            "클립보드로 내보내지 못했습니다."
        );

    // run()을 거치지 않는다. loading이 가져오기 버튼을 막으면 다이얼로그를 닫을 때 포커스가 그 버튼으로 돌아가지 못한다.
    const submitImport = async (text: string): Promise<Done | undefined> => {
        try {
            return undoable("데이터를 가져왔습니다.", await writeSettings(parseImport(text), "merge"));
        } catch (e) {
            console.error(e);
            notify(`가져오지 못했습니다. ${friendlyMessage(e)}`);
        }
    };

    const clearCloud = () =>
        run(async () => {
            // 자동 백업이 켜져 있으면 다음 설정 변경 때 다시 올라가므로 끈다.
            const wasAuto = await backupStorage.auto().getValue();
            if (wasAuto) await backupStorage.auto().setValue(false);

            await clearCloudBackups();
            return `클라우드 백업을 지웠습니다.${wasAuto ? " 자동 백업도 껐습니다." : ""}`;
        }, "클라우드 백업을 지우지 못했습니다.");

    const clearData = () =>
        run(async () => {
            const wasAuto = await pauseAutoForEmpty({});
            const at = await writeSettings({}, "replace");
            return undoable(`데이터를 초기화했습니다.${wasAuto ? " 클라우드 백업을 지키려고 자동 백업을 껐습니다." : ""}`, at, wasAuto);
        }, "초기화하지 못했습니다.");

    return {loading, forceUpdate, backupCloud, recoverCloud, toggleAutoBackup, exportData, submitImport, clearCloud, clearData, revert};
}

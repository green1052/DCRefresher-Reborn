import {ClipboardCopy, CloudDownload, CloudUpload, FileDown, RefreshCw, Trash2, Undo2, Upload} from "lucide-react";
import {useEffect, useId, useRef, useState} from "react";

import {ConfirmDialog, DialogActions} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog";
import {Field, FieldLabel} from "@/components/ui/field";
import {Switch} from "@/components/ui/switch";
import {ToggleGroup, ToggleGroupItem} from "@/components/ui/toggle-group";
import {focusPanel, panelOf} from "@/components/useReturnFocus";
import {type BackupSlot, clearCloudBackups, type CloudBackupStatus, collectLocalData, readBackupTargets, readCloudBackup, readCloudBackupStatus, runBackup} from "@/core/backup";
import {sendMessage} from "@/core/messaging/protocol";
import {mergeBackup, parseImport, writeSettings} from "@/core/settings-transfer";
import {backupStorage, dbStorage} from "@/core/storage/items";
import {friendlyMessage} from "@/utils/error";
import {arrayIncludes, objectKeys} from "@/utils/typed";

import {downloadJson, formatTime, ImportDialog, Section, useStorageItem} from "./Layout";
import {type Done, notify, notifyDone} from "./optionsStore";

type RestoreMode = "replace" | "merge";

const RESTORE_DESCRIPTIONS: Record<RestoreMode, string> = {
    replace: "현재 설정과 차단/메모 목록을 고른 백업으로 통째로 교체합니다. 백업에 없는 항목은 지워집니다.",
    merge: "현재 설정과 목록은 그대로 두고, 백업에만 있는 차단·메모와 설정을 더합니다. 겹치면 현재 것을 남깁니다."
};

export function DataTab() {
    const {version, lastUpdate} = useStorageItem(dbStorage.meta);
    const backupError = useStorageItem(backupStorage.error);
    const autoBackup = useStorageItem(backupStorage.auto);
    const undo = useStorageItem(backupStorage.undo);
    // 처음 읽기 전(null)에는 덮기 전 확인을 할 수 없으므로 백업 버튼과 자동 백업 스위치를 막는다.
    const [cloud, setCloud] = useState<CloudBackupStatus | null>(null);
    const [restoreOpen, setRestoreOpen] = useState(false);
    const [restoreMode, setRestoreMode] = useState<RestoreMode>("replace");
    const [loading, setLoading] = useState(false);
    // 떠 있는 확인 창. 모달이라 한 번에 하나다.
    const [confirm, setConfirm] = useState<"reset" | "cloudClear" | "manual" | "auto" | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const restoreRef = useRef<HTMLButtonElement>(null);
    const id = useId();

    useEffect(() => {
        // 클라우드 메타에서 읽어 자동 백업(백그라운드)과 다른 기기의 백업도 반영한다.
        // 백업은 sync를 연달아 여러 번 쓴다. 먼저 보낸 읽기가 늦게 와 새 상태를 덮지 않게 마지막 읽기만 반영한다.
        let latest = 0;
        let alive = true;
        const loadStatus = (): void => {
            latest += 1;
            const request = latest;
            void readCloudBackupStatus().then((status) => {
                if (alive && request === latest) setCloud(status);
            }, (e: unknown) => {
                console.error(e);
                // 읽지 못해도 버튼을 계속 막아 두지는 않는다. 이미 읽은 상태는 남긴다.
                if (alive) setCloud((prev) => prev ?? {});
            });
        };
        loadStatus();
        browser.storage.sync.onChanged.addListener(loadStatus);
        return () => {
            alive = false;
            browser.storage.sync.onChanged.removeListener(loadStatus);
        };
    }, []);

    const run = async (action: () => Promise<Done>, failure: string): Promise<void> => {
        // 누른 버튼이 막히면 포커스가 body로 떨어져 알림을 닫은 뒤 돌아갈 곳이 없으므로 가까운 조상(탭 패널)으로 옮겨 둔다.
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
        if (Object.keys(data).length > 0 || !(await backupStorage.auto.getValue())) return false;
        await backupStorage.auto.setValue(false);
        return true;
    };

    // writeSettings가 남긴 직전 상태로 돌린다. 이것도 writeSettings로 쓰므로 한 번 더 하면 되돌리기 전으로 돌아온다.
    // at: 알림의 되돌리기가 맡은 작업의 시각. 그 뒤에 다른 작업이 칸을 덮었으면 엉뚱한 작업을 되돌리지 않는다.
    // auto: 그 작업(초기화)이 끈 자동 백업을 다시 켠다. 쓰기가 실패하면 빈 상태가 올라가지 않게 쓴 뒤에 켠다.
    // 탭의 되돌리기는 켜지 않는다. 한참 뒤에 확인 없이 켜면 그사이 다른 기기가 올린 자동 백업을 덮는다.
    const revert = (at?: number, auto = false) =>
        run(async () => {
            const before = await backupStorage.undo.getValue();
            if (!before) return "되돌릴 데이터가 없습니다.";
            if (at !== undefined && before.createdAt !== at) return "그 뒤에 다른 작업이 있어 이 알림으로는 되돌릴 수 없습니다.";
            const off = await pauseAutoForEmpty(before.data);
            await writeSettings(before.data, "replace");
            if (auto) await backupStorage.auto.setValue(true);
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
            await backupStorage.auto.setValue(on);
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

    const exportFile = () =>
        run(() => collectLocalData().then((data) => downloadJson("dcrefresher", data)).then(() => "데이터를 파일로 내보냈습니다."), "파일로 내보내지 못했습니다.");

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
            const wasAuto = await backupStorage.auto.getValue();
            if (wasAuto) await backupStorage.auto.setValue(false);

            await clearCloudBackups();
            return `클라우드 백업을 지웠습니다.${wasAuto ? " 자동 백업도 껐습니다." : ""}`;
        }, "클라우드 백업을 지우지 못했습니다.");

    const clearData = () =>
        run(async () => {
            const wasAuto = await pauseAutoForEmpty({});
            const at = await writeSettings({}, "replace");
            return undoable(`데이터를 초기화했습니다.${wasAuto ? " 클라우드 백업을 지키려고 자동 백업을 껐습니다." : ""}`, at, wasAuto);
        }, "초기화하지 못했습니다.");

    // 떠 있는 확인 창의 문구와 할 일.
    const confirmed = confirm && {
        reset: {title: "모든 설정과 차단/메모 데이터를 초기화할까요?", label: "초기화", run: clearData},
        manual: {
            title: `${formatTime(cloud?.manual?.createdAt ?? 0)}에 다른 기기에서 올린 수동 백업을 이 기기의 설정으로 덮어씁니다. 백업할까요?`,
            label: "백업",
            run: backupCloud
        },
        cloudClear: {title: `클라우드에 올라간 수동·자동 백업을 모두 지울까요?${autoBackup ? " 자동 백업도 꺼집니다." : ""}`, label: "삭제", run: clearCloud},
        auto: {
            title: `자동 백업을 켜면 ${cloud?.auto?.other ? "다른 기기에서 올린 " : ""}${formatTime(cloud?.auto?.createdAt ?? 0)} 자동 백업을 이 기기의 설정으로 덮어씁니다. 켤까요?`,
            label: "켜기",
            run: () => toggleAutoBackup(true)
        }
    }[confirm];

    return (
        <div>
            <Section title="IP/밴 데이터베이스" desc={`버전: ${version.trim() || "없음"} · 마지막 확인: ${formatTime(lastUpdate)}`}
                     actions={
                         <Button variant="secondary" disabled={loading} onClick={() => void forceUpdate()}>
                             <RefreshCw data-icon="inline-start"/> 지금 갱신
                         </Button>
                     }/>

            <Section
                title="클라우드 백업"
                desc="브라우저 동기화 저장소(최대 100KB)에 설정과 차단/메모 목록을 압축해 백업합니다. 수동 백업과 자동 백업은 따로 저장됩니다."
                actions={
                    <Field orientation="horizontal">
                        {/* 자동 칸은 기기끼리 같이 쓰고 켜는 즉시 이 기기 설정으로 덮인다. 새 기기에서 켰다가 복원할 백업을 잃지 않게 먼저 묻는다. */}
                        <Switch id={`${id}-auto`} checked={autoBackup} disabled={loading || !cloud}
                                onCheckedChange={(on) => (on && cloud?.auto ? setConfirm("auto") : void toggleAutoBackup(on))}/>
                        <FieldLabel htmlFor={`${id}-auto`}>자동 백업</FieldLabel>
                    </Field>
                }
            >
                <p className="mb-3 text-muted-foreground">
                    수동 백업: {formatTime(cloud?.manual?.createdAt ?? 0)} · 자동 백업: {formatTime(cloud?.auto?.createdAt ?? 0)}
                </p>
                {/* 복원 버튼을 Trigger로 둬야 닫을 때 그 버튼으로 포커스가 돌아온다. */}
                <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
                    <div className="flex flex-wrap gap-2">
                        {/* 백업 버튼은 수동 칸을 덮는 것이 할 일이다. 다른 기기가 올린 백업일 때만 묻는다(새 기기에서 복원과 헷갈려 누르는 경우). */}
                        <Button variant="secondary" disabled={loading || !cloud} onClick={() => (cloud?.manual?.other ? setConfirm("manual") : void backupCloud())}>
                            <CloudUpload data-icon="inline-start"/> 백업
                        </Button>
                        <DialogTrigger render={<Button ref={restoreRef} variant="secondary" disabled={loading}/>}>
                            <CloudDownload data-icon="inline-start"/> 복원
                        </DialogTrigger>
                        <Button variant="secondary" disabled={loading || (!cloud?.manual && !cloud?.auto)} onClick={() => setConfirm("cloudClear")}>
                            <Trash2 data-icon="inline-start"/> 삭제
                        </Button>
                    </div>

                    {/* 복원 중에는 복원 버튼이 막혀 포커스를 돌려줄 수 없으므로 가까운 조상(탭 패널)으로 돌린다. */}
                    <DialogContent showCloseButton={false} className="sm:max-w-[420px]"
                                   finalFocus={() => (restoreRef.current?.disabled ? panelOf(restoreRef.current) ?? true : true)}>
                        <DialogHeader>
                            <DialogTitle>어느 백업으로 복원할까요?</DialogTitle>
                        </DialogHeader>
                        <ToggleGroup aria-label="복원 방식" variant="outline" spacing={0} value={[restoreMode]}
                                     onValueChange={([value]) => arrayIncludes(objectKeys(RESTORE_DESCRIPTIONS), value) && setRestoreMode(value)}>
                            <ToggleGroupItem value="replace">덮어쓰기</ToggleGroupItem>
                            <ToggleGroupItem value="merge">합치기</ToggleGroupItem>
                        </ToggleGroup>
                        <DialogDescription>{RESTORE_DESCRIPTIONS[restoreMode]}</DialogDescription>
                        <div className="flex flex-col gap-2">
                            {([
                                ["manual", "수동 백업", cloud?.manual ? formatTime(cloud.manual.createdAt) : undefined],
                                ["auto", "자동 백업", cloud?.auto ? formatTime(cloud.auto.createdAt) : undefined]
                            ] as const).map(([slot, label, time]) => (
                                <Button key={slot} variant="secondary" size="lg" className="justify-between" disabled={!time}
                                        onClick={() => void recoverCloud(slot, restoreMode)}>
                                    {label}
                                    <span className="text-muted-foreground">{time ?? "없음"}</span>
                                </Button>
                            ))}
                        </div>
                        <DialogActions/>
                    </DialogContent>
                </Dialog>
                {autoBackup && (
                    <p className="mt-2 text-xs text-muted-foreground">설정이 바뀌면 1분 뒤에 자동으로 백업합니다.</p>
                )}
                {backupError && (
                    <p className="mt-2 text-xs text-destructive">마지막 백업 실패: {backupError}</p>
                )}
            </Section>

            <Section title="내보내기 / 가져오기"
                     desc="IP/밴 데이터베이스와 캐시를 뺀 모든 설정과 차단/메모 목록을 JSON으로 옮깁니다. 가져오기는 JSON에 든 설정과 목록만 바꾸고, JSON에 없는 것은 그대로 둡니다.">
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" disabled={loading} onClick={() => void exportData()}>
                        <ClipboardCopy data-icon="inline-start"/> 클립보드로 내보내기
                    </Button>
                    <Button variant="secondary" disabled={loading} onClick={() => void exportFile()}>
                        <FileDown data-icon="inline-start"/> 파일로 내보내기
                    </Button>
                    <Button variant="secondary" disabled={loading} onClick={() => setImportOpen(true)}>
                        <Upload data-icon="inline-start"/> 가져오기
                    </Button>
                </div>
            </Section>

            {undo && (
                <Section title="되돌리기"
                         desc={`마지막 초기화·복원·가져오기·되돌리기(${formatTime(undo.createdAt)}) 직전의 설정과 차단/메모 목록으로 돌아갑니다. 그 뒤에 바꾼 것은 사라집니다.`}
                         actions={
                             <Button variant="secondary" disabled={loading} onClick={() => void revert()}>
                                 <Undo2 data-icon="inline-start"/> 되돌리기
                             </Button>
                         }/>
            )}

            <Section title="초기화" desc="모든 설정과 차단/메모 데이터를 삭제합니다. 초기화한 뒤에는 되돌리기로 초기화 직전 상태로 돌아갈 수 있습니다."
                     actions={
                         <Button variant="destructive" disabled={loading} onClick={() => setConfirm("reset")}>
                             <Trash2 data-icon="inline-start"/> 데이터 초기화
                         </Button>
                     }/>

            {confirmed && (
                <ConfirmDialog title={confirmed.title} confirmLabel={confirmed.label} danger onClose={() => setConfirm(null)} onConfirm={() => {
                    setConfirm(null);
                    void confirmed.run();
                }}/>
            )}

            {importOpen && (
                <ImportDialog title="데이터 가져오기"
                              desc="내보낸 JSON 데이터를 붙여 넣거나 파일에서 불러와 주세요. JSON에 든 설정과 목록만 바꾸고 나머지는 그대로 둡니다. 들어 있는 차단/메모 목록은 합치지 않고 통째로 바꿉니다. 기본 차단 모드는 이 기기 것을 남깁니다. 합치려면 차단/메모 탭의 가져오기를 써 주세요."
                              onClose={() => setImportOpen(false)} onSubmit={submitImport}/>
            )}
        </div>
    );
}

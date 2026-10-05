import {CloudDownload, CloudUpload, Download, RefreshCw, Trash2, Upload} from "lucide-react";
import {useEffect, useId, useRef, useState} from "react";

import {ConfirmDialog, DialogActions} from "@/components/dialogs";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog";
import {Field, FieldLabel} from "@/components/ui/field";
import {Switch} from "@/components/ui/switch";
import {ToggleGroup, ToggleGroupItem} from "@/components/ui/toggle-group";
import {focusPanel, panelOf} from "@/components/useReturnFocus";
import {type BackupSlot, CLOUD_QUOTA, type CloudBackupStatus, collectLocalData, readBackupTargets, readCloudBackup, readCloudBackupStatus, runBackup} from "@/core/backup";
import {updateDatabase} from "@/core/database";
import {mergeBackup, parseImport, writeSettings} from "@/core/settings-transfer";
import {backupStorage, dbStorage} from "@/core/storage/items";
import {friendlyMessage} from "@/utils/error";
import {arrayIncludes, objectKeys} from "@/utils/typed";

import {formatBytes, formatTime, ImportDialog, Section, useStorageItem} from "./Layout";
import {notify} from "./optionsStore";

type RestoreMode = "replace" | "merge";

const RESTORE_DESCRIPTIONS: Record<RestoreMode, string> = {
    replace: "현재 설정과 차단/메모 목록을 고른 백업으로 통째로 교체합니다. 백업에 없는 항목은 지워집니다.",
    merge: "현재 설정과 목록은 그대로 두고, 백업에만 있는 차단·메모와 설정을 더합니다. 겹치면 현재 것을 남깁니다."
};

export function DataTab() {
    const {version, lastUpdate} = useStorageItem(dbStorage.meta);
    const backupError = useStorageItem(backupStorage.error);
    const autoBackup = useStorageItem(backupStorage.auto);
    const [cloud, setCloud] = useState<CloudBackupStatus>({used: 0});
    const [restoreOpen, setRestoreOpen] = useState(false);
    const [restoreMode, setRestoreMode] = useState<RestoreMode>("replace");
    const [loading, setLoading] = useState(false);
    const [resetConfirm, setResetConfirm] = useState(false);
    const [autoConfirm, setAutoConfirm] = useState(false);
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
            }, console.error);
        };
        loadStatus();
        browser.storage.sync.onChanged.addListener(loadStatus);
        return () => {
            alive = false;
            browser.storage.sync.onChanged.removeListener(loadStatus);
        };
    }, []);

    const run = async (action: () => Promise<string>, failure: string): Promise<void> => {
        // 누른 버튼이 막히면 포커스가 body로 떨어져 알림을 닫은 뒤 돌아갈 곳이 없으므로 가까운 조상(탭 패널)으로 옮겨 둔다.
        if (document.activeElement !== document.body) focusPanel(document.activeElement);
        setLoading(true);
        let message: string;
        try {
            message = await action();
        } catch (e) {
            console.error(e);
            message = `${failure} ${friendlyMessage(e)}`;
        }
        // 확인 창 안에서 부르면(초기화) 창이 닫히며 포커스가 body로 떨어지고, 알림이 그 body를 돌아갈 곳으로 기억한다.
        if (document.activeElement === document.body) focusPanel(restoreRef.current);
        notify(message);
        setLoading(false);
    };

    const forceUpdate = () => run(() => updateDatabase(true).then(() => "데이터베이스를 갱신했습니다."), "데이터베이스를 갱신하지 못했습니다.");

    const backupCloud = () => run(() => runBackup("manual").then(() => "데이터를 클라우드에 백업했습니다."), "클라우드에 백업하지 못했습니다.");

    const recoverCloud = (slot: BackupSlot, mode: RestoreMode) =>
        run(async () => {
            setRestoreOpen(false);
            const backup = await readCloudBackup(slot);
            if (!backup) return "클라우드에 백업이 없습니다.";

            const data = mode === "merge" ? mergeBackup(await readBackupTargets(), backup.data) : backup.data;
            await writeSettings(data, mode);
            const what = `${formatTime(backup.createdAt)} 백업을`;
            return `${what} ${mode === "merge" ? "합쳤습니다" : "복원했습니다"}. 새 탭에서 디시인사이드를 열어 주세요.`;
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

    // run()을 거치지 않는다. loading이 가져오기 버튼을 막으면 다이얼로그를 닫을 때 포커스가 그 버튼으로 돌아가지 못한다.
    const submitImport = async (text: string): Promise<string | undefined> => {
        try {
            await writeSettings(parseImport(text), "merge");
            return "데이터를 가져왔습니다. 새 탭에서 디시인사이드를 열어 주세요.";
        } catch (e) {
            console.error(e);
            notify(`가져오지 못했습니다. ${friendlyMessage(e)}`);
        }
    };

    const clearData = () =>
        run(async () => {
            // 자동 백업이 켜져 있으면 1분 뒤 빈 설정이 클라우드 백업을 덮어쓰므로 먼저 끈다.
            const wasAuto = await backupStorage.auto.getValue();
            if (wasAuto) await backupStorage.auto.setValue(false);

            await writeSettings({}, "replace");
            return `데이터를 초기화했습니다.${wasAuto ? " 클라우드 백업을 지키려고 자동 백업을 껐습니다." : ""} 새 탭에서 디시인사이드를 열어 주세요.`;
        }, "초기화하지 못했습니다.");

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
                desc="브라우저 동기화 저장소(최대 100KB)에 설정을 압축해 백업합니다. 수동 백업과 자동 백업은 따로 저장됩니다."
                actions={
                    <Field orientation="horizontal">
                        {/* 자동 칸은 기기끼리 같이 쓰고 켜는 즉시 이 기기 설정으로 덮인다. 새 기기에서 켰다가 복원할 백업을 잃지 않게 먼저 묻는다. */}
                        <Switch id={`${id}-auto`} checked={autoBackup} disabled={loading}
                                onCheckedChange={(on) => (on && cloud.auto ? setAutoConfirm(true) : void toggleAutoBackup(on))}/>
                        <FieldLabel htmlFor={`${id}-auto`}>자동 백업</FieldLabel>
                    </Field>
                }
            >
                <p className="text-muted-foreground">
                    수동 백업: {formatTime(cloud.manual?.createdAt ?? 0)} · 자동 백업: {formatTime(cloud.auto?.createdAt ?? 0)}
                </p>
                {/* 한도를 넘으면 백업이 실패하므로 가까워진 것을 미리 보인다. 수동·자동 두 칸이 한도를 나눠 쓴다. */}
                <p className={cloud.used > CLOUD_QUOTA * 0.8 ? "mb-3 text-amber-600 dark:text-amber-400" : "mb-3 text-muted-foreground"}>
                    클라우드 사용량: {formatBytes(cloud.used)} / {formatBytes(CLOUD_QUOTA)}
                    {(cloud.manual || cloud.auto) && ` (수동 ${formatBytes(cloud.manual?.size ?? 0)} · 자동 ${formatBytes(cloud.auto?.size ?? 0)})`}
                </p>
                {/* 복원 버튼을 Trigger로 둬야 닫을 때 그 버튼으로 포커스가 돌아온다. */}
                <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" disabled={loading} onClick={() => void backupCloud()}>
                            <CloudUpload data-icon="inline-start"/> 백업
                        </Button>
                        <DialogTrigger render={<Button ref={restoreRef} variant="secondary" disabled={loading}/>}>
                            <CloudDownload data-icon="inline-start"/> 복원
                        </DialogTrigger>
                    </div>

                    {/* 복원 중에는 복원 버튼이 막혀 포커스를 돌려줄 수 없으므로 가까운 조상(탭 패널)으로 돌린다. */}
                    <DialogContent showCloseButton={false} className="sm:max-w-[420px]"
                                   finalFocus={() => (restoreRef.current?.disabled ? panelOf(restoreRef.current) ?? true : true)}>
                        <DialogHeader>
                            <DialogTitle>어느 백업으로 복원할까요?</DialogTitle>
                        </DialogHeader>
                        <ToggleGroup variant="outline" spacing={0} value={[restoreMode]}
                                     onValueChange={([value]) => arrayIncludes(objectKeys(RESTORE_DESCRIPTIONS), value) && setRestoreMode(value)}>
                            <ToggleGroupItem value="replace">덮어쓰기</ToggleGroupItem>
                            <ToggleGroupItem value="merge">합치기</ToggleGroupItem>
                        </ToggleGroup>
                        <DialogDescription>{RESTORE_DESCRIPTIONS[restoreMode]}</DialogDescription>
                        <div className="flex flex-col gap-2">
                            {([
                                ["manual", "수동 백업", cloud.manual ? formatTime(cloud.manual.createdAt) : undefined],
                                ["auto", "자동 백업", cloud.auto ? formatTime(cloud.auto.createdAt) : undefined]
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
                     desc="IP/밴 데이터베이스와 캐시를 뺀 모든 설정을 JSON으로 옮깁니다. 가져오기는 JSON에 든 설정과 목록만 바꾸고, JSON에 없는 것은 그대로 둡니다.">
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" disabled={loading} onClick={() => void exportData()}>
                        <Download data-icon="inline-start"/> 클립보드로 내보내기
                    </Button>
                    <Button variant="secondary" disabled={loading} onClick={() => setImportOpen(true)}>
                        <Upload data-icon="inline-start"/> 가져오기
                    </Button>
                </div>
            </Section>

            <Section title="초기화" desc="모든 설정과 차단/메모 데이터를 삭제합니다. 되돌릴 수 없습니다."
                     actions={
                         <Button variant="destructive" disabled={loading} onClick={() => setResetConfirm(true)}>
                             <Trash2 data-icon="inline-start"/> 데이터 초기화
                         </Button>
                     }/>

            {resetConfirm && (
                <ConfirmDialog
                    title="모든 설정과 차단/메모 데이터를 초기화할까요?"
                    confirmLabel="초기화"
                    danger
                    onConfirm={() => {
                        setResetConfirm(false);
                        void clearData();
                    }}
                    onClose={() => setResetConfirm(false)}
                />
            )}

            {autoConfirm && (
                <ConfirmDialog
                    title={`자동 백업을 켜면 ${formatTime(cloud.auto?.createdAt ?? 0)} 자동 백업을 이 기기의 설정으로 덮어씁니다. 켤까요?`}
                    confirmLabel="켜기"
                    danger
                    onConfirm={() => {
                        setAutoConfirm(false);
                        void toggleAutoBackup(true);
                    }}
                    onClose={() => setAutoConfirm(false)}
                />
            )}

            {importOpen && (
                <ImportDialog title="데이터 가져오기"
                              desc="내보낸 JSON 데이터를 붙여 넣어 주세요. JSON에 든 설정과 목록만 바꾸고 나머지는 그대로 둡니다. 들어 있는 차단/메모 목록은 합치지 않고 통째로 바꿉니다. 기본 차단 모드는 이 기기 것을 남깁니다. 합치려면 차단/메모 탭의 가져오기를 써 주세요."
                              onClose={() => setImportOpen(false)} onSubmit={submitImport}/>
            )}
        </div>
    );
}

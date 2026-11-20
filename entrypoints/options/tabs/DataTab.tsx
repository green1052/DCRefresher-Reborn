import {CloudDownload, CloudUpload, Download, RefreshCw, Trash2, Undo2, Upload} from "lucide-preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";

import {ConfirmDialog, DialogActions, DialogDescription, DialogHeader, DialogTitle, ModalDialog} from "@/components/dialogs";
import {type CloudBackupStatus, readCloudBackupStatus} from "@/core/backup";
import {backupStorage, dbMetaStorage} from "@/core/storage/items";
import {cn} from "cn";

import {formatTime} from "../shared/format";
import {useStorageItem} from "../shared/hooks";
import {ImportDialog} from "../shared/ImportDialog";
import {Section} from "../shared/widgets";
import {type RestoreMode, useDataActions} from "./useDataActions";

const RESTORE_DESCRIPTIONS: Record<RestoreMode, string> = {
    replace: "현재 설정과 차단/메모 목록을 고른 백업으로 통째로 교체합니다. 백업에 없는 항목은 지워집니다.",
    merge: "현재 설정과 목록은 그대로 두고, 백업에만 있는 차단, 메모와 설정을 더합니다. 겹치면 현재 것을 남깁니다."
};

export function DataTab() {
    const {version} = useStorageItem(dbMetaStorage());
    const backupError = useStorageItem(backupStorage.error());
    const autoBackup = useStorageItem(backupStorage.auto());
    const undo = useStorageItem(backupStorage.undo());
    // 처음 읽기 전(null)에는 덮기 전 확인을 할 수 없으므로 백업 버튼과 자동 백업 스위치를 막는다.
    const [cloud, setCloud] = useState<CloudBackupStatus | null>(null);
    const [restoreOpen, setRestoreOpen] = useState(false);
    const [restoreMode, setRestoreMode] = useState<RestoreMode>("replace");
    // 떠 있는 확인 창. 모달이라 한 번에 하나다.
    const [confirm, setConfirm] = useState<"reset" | "cloudClear" | "manual" | "auto" | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const restoreRef = useRef<HTMLButtonElement>(null);
    const id = useId();
    const {
        loading,
        forceUpdate,
        backupCloud,
        recoverCloud,
        toggleAutoBackup,
        exportData,
        submitImport,
        clearCloud,
        clearData,
        revert
    } =
        useDataActions(restoreRef, setRestoreOpen);

    useEffect(() => {
        // 클라우드 메타를 읽고 sync가 바뀌면 다시 읽는다 - 연달아 오는 읽기는 마지막 것만 반영한다.
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

    const confirmed = confirm && {
        reset: {title: "모든 설정과 차단/메모 데이터를 초기화할까요?", label: "초기화", run: clearData},
        manual: {
            title: `${formatTime(cloud?.manual?.createdAt ?? 0)}에 다른 기기에서 올린 수동 백업을 이 기기의 설정으로 덮어씁니다. 백업할까요?`,
            label: "백업",
            run: backupCloud
        },
        cloudClear: {
            title: `클라우드에 올라간 수동, 자동 백업을 모두 지울까요?${autoBackup ? " 자동 백업도 꺼집니다." : ""}`,
            label: "삭제",
            run: clearCloud
        },
        auto: {
            title: `자동 백업을 켜면 ${cloud?.auto?.other ? "다른 기기에서 올린 " : ""}${formatTime(cloud?.auto?.createdAt ?? 0)} 자동 백업을 이 기기의 설정으로 덮어씁니다. 켤까요?`,
            label: "켜기",
            run: () => toggleAutoBackup(true)
        }
    }[confirm];

    return (
        <div>
            <Section title="IP/밴 데이터베이스" desc={`버전: ${version.trim() || "없음"}`}
                     actions={
                         <button type="button" className="btn" disabled={loading} onClick={() => void forceUpdate()}>
                             <RefreshCw className="size-4"/> 갱신
                         </button>
                     }/>

            <Section
                title="클라우드 백업"
                desc="브라우저 동기화 저장소에 설정을 백업합니다."
                actions={
                    <div className="flex items-center gap-3">
                        {/* 자동 칸은 기기끼리 같이 쓰고 켜는 즉시 이 기기 설정으로 덮인다. 새 기기에서 켰다가 복원할 백업을 잃지 않게 먼저 묻는다. */}
                        <input id={`${id}-auto`} type="checkbox" role="switch" className="toggle"
                               checked={autoBackup} disabled={loading || !cloud}
                               onChange={(ev) => (ev.currentTarget.checked && cloud?.auto ? setConfirm("auto") : void toggleAutoBackup(ev.currentTarget.checked))}/>
                        <label htmlFor={`${id}-auto`} className="text-sm font-medium leading-snug">자동 백업</label>
                    </div>
                }
            >
                <p className="mb-3 text-base-content/60">
                    수동 백업: {formatTime(cloud?.manual?.createdAt ?? 0)}
                    <br/>
                    자동 백업: {formatTime(cloud?.auto?.createdAt ?? 0)}
                </p>
                <div className="flex flex-wrap gap-2">
                    {/* 백업 버튼은 원래 수동 칸을 덮는다. 다른 기기가 올린 백업일 때만 묻는다(새 기기에서 복원과 헷갈려 누르는 경우). */}
                    <button type="button" className="btn" disabled={loading || !cloud}
                            onClick={() => (cloud?.manual?.other ? setConfirm("manual") : void backupCloud())}>
                        <CloudUpload className="size-4"/> 백업
                    </button>
                    {/* 복원 중에는 복원 버튼이 막혀 포커스를 돌려줄 수 없으므로 가까운 조상(탭 패널)으로 돌린다. */}
                    <button ref={restoreRef} type="button" className="btn" disabled={loading}
                            onClick={() => setRestoreOpen(true)}>
                        <CloudDownload className="size-4"/> 복원
                    </button>
                    <button type="button" className="btn" disabled={loading || (!cloud?.manual && !cloud?.auto)}
                            onClick={() => setConfirm("cloudClear")}>
                        <Trash2 className="size-4"/> 삭제
                    </button>
                </div>

                {restoreOpen && (
                    <ModalDialog onClose={() => setRestoreOpen(false)} className="sm:max-w-105">
                        <DialogHeader>
                            <DialogTitle>어느 백업으로 복원할까요?</DialogTitle>
                        </DialogHeader>
                        <div role="group" aria-label="복원 방식" className="join">
                            <button type="button" aria-pressed={restoreMode === "replace"}
                                    className={cn("btn btn-outline join-item", restoreMode === "replace" && "btn-active")}
                                    onClick={() => setRestoreMode("replace")}>덮어쓰기</button>
                            <button type="button" aria-pressed={restoreMode === "merge"}
                                    className={cn("btn btn-outline join-item", restoreMode === "merge" && "btn-active")}
                                    onClick={() => setRestoreMode("merge")}>합치기</button>
                        </div>
                        <DialogDescription>{RESTORE_DESCRIPTIONS[restoreMode]}</DialogDescription>
                        <div className="flex flex-col gap-2">
                            {([
                                ["manual", "수동 백업", cloud?.manual ? formatTime(cloud.manual.createdAt) : undefined],
                                ["auto", "자동 백업", cloud?.auto ? formatTime(cloud.auto.createdAt) : undefined]
                            ] as const).map(([slot, label, time]) => (
                                <button key={slot} type="button" className="btn justify-between"
                                        disabled={!time}
                                        onClick={() => void recoverCloud(slot, restoreMode)}>
                                    {label}
                                    <span className="text-base-content/60">{time ?? "없음"}</span>
                                </button>
                            ))}
                        </div>
                        <DialogActions/>
                    </ModalDialog>
                )}
                {autoBackup && (
                    <p className="mt-2 text-xs text-base-content/60">설정이 바뀌면 1분 뒤에 자동으로 백업합니다.</p>
                )}
                {backupError && (
                    <p className="mt-2 text-xs text-error">마지막 백업 실패: {backupError}</p>
                )}
            </Section>

            <Section title="내보내기 / 가져오기"
                     desc="설정을 내보냅니다.">
                <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn" disabled={loading} onClick={() => void exportData()}>
                        <Download className="size-4"/> 내보내기
                    </button>
                    <button type="button" className="btn" disabled={loading} onClick={() => setImportOpen(true)}>
                        <Upload className="size-4"/> 가져오기
                    </button>
                </div>
            </Section>

            {undo && (
                <Section title="되돌리기"
                         desc={`마지막 초기화, 복원, 가져오기, 되돌리기(${formatTime(undo.createdAt)}) 직전의 설정과 차단/메모 목록으로 돌아갑니다. 그 뒤에 바꾼 것은 사라집니다.`}
                         actions={
                             <button type="button" className="btn" disabled={loading} onClick={() => void revert()}>
                                 <Undo2 className="size-4"/> 되돌리기
                             </button>
                         }/>
            )}

            <Section title="초기화" desc="모든 설정을 삭제합니다."
                     actions={
                         <button type="button" className="btn btn-error" disabled={loading} onClick={() => setConfirm("reset")}>
                             <Trash2 className="size-4"/> 데이터 초기화
                         </button>
                     }/>

            {confirmed && (
                <ConfirmDialog title={confirmed.title} confirmLabel={confirmed.label} danger
                               onClose={() => setConfirm(null)} onConfirm={() => {
                    setConfirm(null);
                    void confirmed.run();
                }}/>
            )}

            {importOpen && (
                <ImportDialog title="데이터 가져오기"
                              desc={"차단, 메모는 통째로 덮어씁니다."}
                              onClose={() => setImportOpen(false)} onSubmit={submitImport}/>
            )}
        </div>
    );
}

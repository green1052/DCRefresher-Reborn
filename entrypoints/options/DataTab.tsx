import {CloudDownload, CloudUpload, Download, RefreshCw, Trash2, Upload} from "lucide-react";
import {Box, Button, Dialog, Flex, Switch, Text} from "@radix-ui/themes";
import {useEffect, useState} from "react";

import {ConfirmDialog, DialogActions, Notice} from "@/components/ConfirmDialog";
import {type BackupSlot, collectLocalData, isBackupTarget, readCloudBackup, readCloudBackupTimes, runBackup} from "@/core/backup";
import {updateDatabase} from "@/core/database";
import {migrateV5} from "@/core/migrate-v5";
import {backupStorage, dbStorage} from "@/core/storage/items";
import {normalizeBlockList} from "@/stores/blocks";

import {formatTime, ImportDialog, Section, useStorageItem} from "./Layout";

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** 값 여러 개를 객체 하나에 담는 키 — 모듈 on/off, 기본 차단 모드, 모듈별 설정 */
const isMapKey = (key: string): boolean =>
    key === "refresher:modules" || key === "refresher:block:defaults" || /^refresher:module:.+:settings$/.test(key);

/**
 * 설정(백업 대상 키)을 쓴다 — IP/밴 DB·백업 상태·모듈 캐시는 그대로 둔다.
 * - replace (클라우드 복원·초기화): 백업은 완전한 스냅숏이라 거기 없는 설정 키는 지운다
 * - merge (가져오기): 붙여넣은 JSON은 일부만 담을 수 있어 있는 키만 쓴다 — 설정만 든 JSON이 차단/메모 목록을 지우지 않게.
 *   설정 객체(isMapKey)도 기존 값에 얕게 합친다 — 설정 몇 개만 든 JSON이 나머지 설정을 기본값으로 돌리지 않게
 * 쓰다가 실패하면 이전 값으로 되돌린다.
 */
const writeSettings = async (data: Record<string, unknown>, mode: "replace" | "merge"): Promise<void> => {
    const previous = (await browser.storage.local.get(null)) as Record<string, unknown>;
    // 설정 키가 아닌 값(차단/메모 내보내기의 "NICK" 등)은 저장하지 않는다
    const next = Object.fromEntries(Object.entries(migrateV5(data)).filter(([key]) => key.startsWith("refresher:") && isBackupTarget(key)));
    // 걸러서 다 빠지면 복원은 모든 설정을 지우고 가져오기는 아무것도 안 쓴다 (예전 백업의 키가 migrateV5에서 전부 빠지는 등) — 비우는 건 초기화({})만
    if (Object.keys(data).length > 0 && Object.keys(next).length === 0) throw new Error("쓸 수 있는 설정이 없습니다.");
    // 백업은 차단 항목 id를 빼고 올린다 (용량) — 저장할 때 다시 붙인다
    for (const [key, value] of Object.entries(next)) {
        if (/^refresher:block:[A-Z]+$/.test(key)) next[key] = normalizeBlockList(value);
    }
    if (mode === "merge") {
        for (const [key, value] of Object.entries(next)) {
            const old = previous[key];
            if (isMapKey(key) && isRecord(old) && isRecord(value)) next[key] = {...old, ...value};
        }
    }
    const removed = mode === "replace" ? Object.keys(previous).filter((key) => isBackupTarget(key) && !(key in next)) : [];

    try {
        await browser.storage.local.remove(removed);
        await browser.storage.local.set(next);
    } catch (e) {
        await browser.storage.local.set(previous);
        throw e;
    }
};

const parseImport = (input: string): Record<string, unknown> => {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("가져오기 데이터는 JSON 객체여야 합니다.");
    }
    // 차단/메모 내보내기나 {}를 붙여넣으면 아무것도 안 쓰고 "가져왔습니다"가 뜬다 — 잘못 붙여넣은 걸 알린다
    if (!Object.keys(parsed).some((key) => key.startsWith("refresher:"))) {
        throw new Error("설정 데이터가 아닙니다.");
    }
    return parsed as Record<string, unknown>;
};

export function DataTab() {
    const {lastUpdate} = useStorageItem(dbStorage.meta);
    const backupError = useStorageItem(backupStorage.error);
    const autoBackup = useStorageItem(backupStorage.auto);
    const [backupTimes, setBackupTimes] = useState<Awaited<ReturnType<typeof readCloudBackupTimes>>>({legacy: false});
    const [restoreOpen, setRestoreOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [resetConfirm, setResetConfirm] = useState(false);
    const [autoConfirm, setAutoConfirm] = useState(false);
    const [importOpen, setImportOpen] = useState(false);

    useEffect(() => {
        // 백업 시각은 클라우드 메타에서 — 자동 백업(백그라운드)·다른 기기의 백업도 따라간다
        const loadTimes = (): void => void readCloudBackupTimes().then(setBackupTimes);
        const onChanged = (_: unknown, area: string): void => {
            if (area === "sync") loadTimes();
        };
        loadTimes();
        browser.storage.onChanged.addListener(onChanged);
        return () => browser.storage.onChanged.removeListener(onChanged);
    }, []);

    const run = async (action: () => Promise<string>, failure: string): Promise<void> => {
        setLoading(true);
        try {
            setNotice(await action());
        } catch (e) {
            setNotice(`${failure} ${errorMessage(e)}`);
        } finally {
            setLoading(false);
        }
    };

    const forceUpdate = () =>
        run(async () => {
            await updateDatabase();
            return "데이터베이스를 갱신했습니다.";
        }, "데이터베이스를 갱신하지 못했습니다.");

    const backupCloud = () =>
        run(async () => {
            await runBackup("manual");
            return "데이터를 클라우드에 백업했습니다.";
        }, "클라우드에 백업하지 못했습니다.");

    const recoverCloud = (slot: BackupSlot) =>
        run(async () => {
            setRestoreOpen(false);
            const backup = await readCloudBackup(slot);
            if (!backup) return "클라우드에 백업이 없습니다.";

            await writeSettings(backup.data, "replace");
            return `${backup.createdAt ? `${formatTime(backup.createdAt)} 백업을` : "데이터를"} 복원했습니다. 새 탭에서 디시인사이드를 열어주세요.`;
        }, "복원하지 못했습니다.");

    const toggleAutoBackup = async (on: boolean): Promise<void> => {
        try {
            await backupStorage.auto.setValue(on);
        } catch (e) {
            setNotice(`자동 백업 설정을 저장하지 못했습니다. ${errorMessage(e)}`);
            return;
        }
        // 켜는 순간의 설정을 자동 백업 칸에 바로 올려 둔다 (이후엔 바뀔 때마다 백그라운드가)
        if (on) {
            await run(async () => {
                await runBackup("auto");
                return "자동 백업을 켰습니다. 지금 설정을 자동 백업으로 올렸습니다.";
            }, "자동 백업을 켰지만 첫 백업에 실패했습니다.");
        }
    };

    const exportData = () =>
        run(async () => {
            await navigator.clipboard.writeText(JSON.stringify(await collectLocalData()));
            return "데이터를 클립보드로 내보냈습니다.";
        }, "클립보드로 내보내지 못했습니다.");

    const submitImport = (text: string) =>
        run(async () => {
            await writeSettings(parseImport(text), "merge");
            setImportOpen(false);
            return "데이터를 가져왔습니다. 새 탭에서 디시인사이드를 열어주세요.";
        }, "가져오지 못했습니다.");

    const clearData = () =>
        run(async () => {
            // 자동 백업이 켜져 있으면 1분 뒤 빈 설정이 클라우드 백업을 덮어쓴다 — 먼저 끈다
            const wasAuto = await backupStorage.auto.getValue();
            if (wasAuto) await backupStorage.auto.setValue(false);

            await writeSettings({}, "replace");
            // 백업 대상이 아니라 writeSettings가 건드리지 않는 비회원 비밀번호도 지운다
            await browser.storage.local.remove("refresher:nonmember");
            return `데이터를 초기화했습니다.${wasAuto ? " 클라우드 백업을 지키려고 자동 백업을 껐습니다." : ""} 새 탭에서 디시인사이드를 열어주세요.`;
        }, "초기화하지 못했습니다.");

    return (
        <Box>
            <Section title="IP/밴 데이터베이스" desc={`마지막 갱신: ${formatTime(lastUpdate)}`}
                     actions={
                         <Button variant="soft" disabled={loading} onClick={() => void forceUpdate()}>
                             <RefreshCw size={14}/> 지금 갱신
                         </Button>
                     }/>

            <Section
                title="클라우드 백업"
                desc="브라우저 동기화 저장소(최대 100KB)에 설정을 압축해 백업합니다. 수동 백업과 자동 백업은 따로 저장됩니다."
                actions={
                    <Text as="label" size="2">
                        <Flex gap="2" align="center">
                            {/* 자동 칸은 기기끼리 같이 쓰고 켜는 즉시 이 기기 설정으로 덮는다 — 새 기기에서 켜 복원할 백업을 잃지 않게 먼저 묻는다 */}
                            <Switch checked={autoBackup} disabled={loading}
                                    onCheckedChange={(on) => (on && backupTimes.auto ? setAutoConfirm(true) : void toggleAutoBackup(on))}/>
                            자동 백업
                        </Flex>
                    </Text>
                }
            >
                <Text as="p" size="2" color="gray" mb="3">
                    수동 백업: {formatTime(backupTimes.manual ?? 0)} · 자동 백업: {formatTime(backupTimes.auto ?? 0)}
                </Text>
                <Flex gap="2" wrap="wrap">
                    <Button variant="soft" disabled={loading} onClick={() => void backupCloud()}>
                        <CloudUpload size={14}/> 백업
                    </Button>
                    <Button variant="soft" disabled={loading} onClick={() => setRestoreOpen(true)}>
                        <CloudDownload size={14}/> 복원
                    </Button>
                </Flex>

                <Dialog.Root open={restoreOpen} onOpenChange={setRestoreOpen}>
                    <Dialog.Content maxWidth="420px">
                        <Dialog.Title>어느 백업으로 복원할까요?</Dialog.Title>
                        <Dialog.Description size="2" mb="3">
                            현재 설정과 차단/메모 목록을 고른 백업으로 통째로 교체합니다. 백업에 없는 항목은 지워집니다.
                        </Dialog.Description>
                        <Flex direction="column" gap="2">
                            {([
                                ["manual", "수동 백업", backupTimes.manual ? formatTime(backupTimes.manual) : backupTimes.legacy ? "예전 방식 백업" : undefined],
                                ["auto", "자동 백업", backupTimes.auto ? formatTime(backupTimes.auto) : undefined]
                            ] as const).map(([slot, label, time]) => (
                                <Button key={slot} variant="soft" size="3" disabled={!time} onClick={() => void recoverCloud(slot)}
                                        style={{justifyContent: "space-between"}}>
                                    {label}
                                    <Text size="2" color="gray">{time ?? "없음"}</Text>
                                </Button>
                            ))}
                        </Flex>
                        <DialogActions/>
                    </Dialog.Content>
                </Dialog.Root>
                {autoBackup && (
                    <Text as="p" size="1" color="gray" mt="2">설정이 바뀌면 1분 뒤에 자동으로 백업합니다.</Text>
                )}
                {backupError && (
                    <Text as="p" size="1" color="red" mt="2">마지막 백업 실패: {backupError}</Text>
                )}
            </Section>

            <Section title="내보내기 / 가져오기"
                     desc="IP/밴 데이터베이스와 캐시를 뺀 모든 설정을 JSON으로 옮깁니다. 가져오기는 JSON에 든 설정과 목록만 바꾸고, JSON에 없는 것은 그대로 둡니다.">
                <Flex gap="2" wrap="wrap">
                    <Button variant="soft" disabled={loading} onClick={() => void exportData()}>
                        <Download size={14}/> 클립보드로 내보내기
                    </Button>
                    <Button variant="soft" disabled={loading} onClick={() => setImportOpen(true)}>
                        <Upload size={14}/> 가져오기
                    </Button>
                </Flex>
            </Section>

            <Section title="초기화" desc="모든 설정과 차단/메모 데이터를 삭제합니다. 되돌릴 수 없습니다."
                     actions={
                         <Button
                             variant="soft"
                             color="red"
                             disabled={loading}
                             onClick={() => setResetConfirm(true)}
                         >
                             <Trash2 size={14}/> 데이터 초기화
                         </Button>
                     }/>

            <Notice message={notice} onClose={() => setNotice(null)}/>

            {resetConfirm && (
                <ConfirmDialog
                    title="모든 설정과 사용자 데이터를 초기화할까요?"
                    confirmLabel="확인"
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
                    title={`자동 백업을 켜면 ${formatTime(backupTimes.auto ?? 0)} 자동 백업을 이 기기의 설정으로 덮어씁니다. 켤까요?`}
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
                              desc="내보낸 JSON 데이터를 붙여넣어주세요. JSON에 든 설정과 목록만 바꾸고 나머지는 그대로 둡니다. 들어 있는 차단/메모 목록은 합치지 않고 통째로 바꿉니다. 합치려면 차단/메모 탭의 가져오기를 쓰세요."
                              onClose={() => setImportOpen(false)} onSubmit={submitImport}/>
            )}
        </Box>
    );
}

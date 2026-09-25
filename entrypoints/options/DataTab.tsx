import {CloudDownload, CloudUpload, Download, RefreshCw, Trash2, Upload} from "lucide-react";
import {Box, Button, Dialog, Flex, Switch, Text} from "@radix-ui/themes";
import {useEffect, useState} from "react";

import {ConfirmDialog} from "@/components/ConfirmDialog";
import {type BackupSlot, collectLocalData, isBackupTarget, readCloudBackup, readCloudBackupTimes, runBackup} from "@/core/backup";
import {updateDatabase} from "@/core/database";
import {backupStorage, dbStorage} from "@/core/storage/items";

import {ImportDialog, Section} from "./Layout";

const formatTime = (lastUpdate: number): string =>
    lastUpdate === 0 ? "기록 없음" : new Date(lastUpdate).toLocaleString("ko-KR");

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * 설정(백업 대상 키)만 갈아끼운다 — IP/밴 DB·백업 상태·모듈 캐시는 그대로 둔다.
 * 쓰다가 실패하면 이전 값으로 되돌린다.
 */
const replaceSettings = async (data: Record<string, unknown>): Promise<void> => {
    const previous = (await browser.storage.local.get(null)) as Record<string, unknown>;
    const next = Object.fromEntries(Object.entries(data).filter(([key]) => isBackupTarget(key)));
    const removed = Object.keys(previous).filter((key) => isBackupTarget(key) && !(key in next));

    try {
        await browser.storage.local.remove(removed);
        await browser.storage.local.set(next);
    } catch (error) {
        await browser.storage.local.set(previous);
        throw error;
    }
};

const parseImport = (input: string): Record<string, unknown> => {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("가져오기 데이터는 JSON 객체여야 합니다.");
    }
    return parsed as Record<string, unknown>;
};

interface ConfirmState {
    title: string;
    action: () => Promise<void>;
}

export function DataTab() {
    const [lastUpdate, setLastUpdate] = useState(0);
    const [backupTimes, setBackupTimes] = useState<Awaited<ReturnType<typeof readCloudBackupTimes>>>({legacy: false});
    const [restoreOpen, setRestoreOpen] = useState(false);
    const [backupError, setBackupError] = useState("");
    const [autoBackup, setAutoBackup] = useState(false);
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<ConfirmState | null>(null);
    const [importOpen, setImportOpen] = useState(false);

    useEffect(() => {
        void dbStorage.getValue().then((db) => setLastUpdate(db.lastUpdate));
        void backupStorage.error.getValue().then(setBackupError);
        void backupStorage.auto.getValue().then(setAutoBackup);

        // 백업 시각은 클라우드 메타에서 — 자동 백업(백그라운드)·다른 기기의 백업도 따라간다
        const loadTimes = (): void => void readCloudBackupTimes().then(setBackupTimes);
        const onChanged = (_: unknown, area: string): void => {
            if (area === "sync") loadTimes();
        };
        loadTimes();
        browser.storage.onChanged.addListener(onChanged);
        const unwatchError = backupStorage.error.watch((value) => setBackupError(value ?? ""));

        return () => {
            browser.storage.onChanged.removeListener(onChanged);
            unwatchError();
        };
    }, []);

    const run = async (action: () => Promise<string>, failure: string): Promise<void> => {
        setLoading(true);
        try {
            setNotice(await action());
        } catch (error) {
            setNotice(`${failure} ${errorMessage(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const forceUpdate = async (): Promise<void> => {
        setLoading(true);
        try {
            await updateDatabase();
            setLastUpdate((await dbStorage.getValue()).lastUpdate);
        } finally {
            setLoading(false);
        }
    };

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

            await replaceSettings(backup.data);
            return `${backup.createdAt ? `${formatTime(backup.createdAt)} 백업을` : "데이터를"} 복원했습니다. 새 탭에서 디시인사이드를 열어주세요.`;
        }, "복원하지 못했습니다.");

    const toggleAutoBackup = async (on: boolean): Promise<void> => {
        setAutoBackup(on);
        await backupStorage.auto.setValue(on);
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
            await replaceSettings(parseImport(text));
            setImportOpen(false);
            return "데이터를 가져왔습니다. 새 탭에서 디시인사이드를 열어주세요.";
        }, "가져오지 못했습니다.");

    const clearData = () =>
        run(async () => {
            // 자동 백업이 켜져 있으면 1분 뒤 빈 설정이 클라우드 백업을 덮어쓴다 — 먼저 끈다
            const wasAuto = await backupStorage.auto.getValue();
            if (wasAuto) {
                await backupStorage.auto.setValue(false);
                setAutoBackup(false);
            }

            await replaceSettings({});
            return `데이터를 초기화했습니다.${wasAuto ? " 클라우드 백업을 지키려고 자동 백업을 껐습니다." : ""} 새 탭에서 디시인사이드를 열어주세요.`;
        }, "초기화하지 못했습니다.");

    return (
        <Box>
            <Section title="IP/밴 데이터베이스" desc={`마지막 갱신: ${formatTime(lastUpdate)}`}
                     actions={
                         <Button variant="soft" loading={loading} onClick={() => void forceUpdate()}>
                             <RefreshCw size={14}/> 지금 갱신
                         </Button>
                     }/>

            <Section
                title="클라우드 백업"
                desc="브라우저 동기화 저장소(최대 100KB)에 설정을 압축해 백업합니다. 수동 백업과 자동 백업은 따로 저장됩니다."
                actions={
                    <Text as="label" size="2">
                        <Flex gap="2" align="center">
                            <Switch checked={autoBackup} disabled={loading} onCheckedChange={(on) => void toggleAutoBackup(on)}/>
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
                        <Dialog.Description size="2" mb="3">현재 설정을 고른 백업으로 교체합니다.</Dialog.Description>
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
                        <Flex justify="end" mt="4">
                            <Dialog.Close>
                                <Button variant="soft" color="gray">취소</Button>
                            </Dialog.Close>
                        </Flex>
                    </Dialog.Content>
                </Dialog.Root>
                {autoBackup && (
                    <Text as="p" size="1" color="gray" mt="2">설정이 바뀌면 1분 뒤에 자동으로 백업합니다.</Text>
                )}
                {backupError && (
                    <Text as="p" size="1" color="red" mt="2">마지막 백업 실패: {backupError}</Text>
                )}
            </Section>

            <Section title="내보내기 / 가져오기" desc="IP/밴 데이터베이스와 캐시를 뺀 모든 설정을 JSON으로 옮깁니다.">
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
                             onClick={() => setConfirming({title: "모든 설정과 사용자 데이터를 초기화할까요?", action: clearData})}
                         >
                             <Trash2 size={14}/> 데이터 초기화
                         </Button>
                     }/>

            <ConfirmDialog open={notice !== null} title={notice ?? ""} cancelLabel={null}
                           onClose={() => setNotice(null)} onConfirm={() => setNotice(null)}/>

            <ConfirmDialog
                open={confirming !== null}
                title={confirming?.title ?? ""}
                confirmLabel="확인"
                danger
                onConfirm={() => {
                    const target = confirming;
                    setConfirming(null);
                    if (target) void target.action();
                }}
                onClose={() => setConfirming(null)}
            />

            <ImportDialog open={importOpen} title="데이터 가져오기"
                          onClose={() => setImportOpen(false)} onSubmit={submitImport}/>
        </Box>
    );
}

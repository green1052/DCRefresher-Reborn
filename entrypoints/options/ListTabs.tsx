import {Download, Plus, Search, Trash2, Upload} from "lucide-react";
import {type ReactNode, useRef, useState} from "react";

import {ConfirmDialog} from "@/components/dialogs";
import {WithTooltip} from "@/components/WithTooltip";
import {focusPanel} from "@/components/useReturnFocus";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Empty, EmptyDescription} from "@/components/ui/empty";
import {InputGroup, InputGroupAddon, InputGroupInput} from "@/components/ui/input-group";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {friendlyMessage, SAVE_FAILED} from "@/utils/error";
import {isRecord} from "@/utils/record";

import {ImportDialog} from "./Layout";
import {notify} from "./optionsStore";
import {RefresherSelect} from "./RefresherSelect";

const EmptyList = ({children}: { children: ReactNode }) => (
    <Empty>
        <EmptyDescription>{children}</EmptyDescription>
    </Empty>
);


/** 오래 안 쓴 항목 거르기. 쓰인 시각은 이 기기에서 걸리거나(차단) 보인(메모) 때다. */
const UNUSED_OPTIONS = {"0": "사용 기록 전체", "30": "30일 넘게 안 쓰임", "90": "90일 넘게 안 쓰임", "180": "180일 넘게 안 쓰임"};

/** 받침이 있으면 "을", 없으면 "를". */
const objectParticle = (word: string): string => ((word.charCodeAt(word.length - 1) - 0xac00) % 28 > 0 ? "을" : "를");

const DAY = 24 * 60 * 60 * 1000;

/** 표에 한 번에 그리는 줄 수. 수천 줄을 다 그리면 검색어를 칠 때마다 느려진다(5,000줄에서 한 글자에 50ms쯤). 검색은 전체에서 한다. */
const PAGE = 200;

/** 마지막으로 쓰인 시각 표시 ("오늘", "3일 전"). */
const formatUsed = (time: number | undefined): string => {
    if (time === undefined) return "—";
    const days = Math.floor((Date.now() - time) / DAY);
    return days < 1 ? "오늘" : `${days}일 전`;
};

/** 표 한 줄. 줄을 누르면 편집하고, 휴지통 버튼은 확인을 받고 삭제한다. */
export const ListRow = ({head, label, info, used, onEdit, onRemove}: {
    head: ReactNode;
    /** 항목 이름 (내용/유저). 삭제 버튼 이름과 확인 문구에 쓴다. */
    label: string;
    info: ReactNode;
    /** 마지막으로 쓰인 시각 (useUsage). */
    used?: number;
    onEdit: () => void;
    onRemove: () => void;
}) => {
    // 확인 창을 연 휴지통 버튼. 지우면 버튼이 사라져 확인 창이 포커스를 돌려줄 곳이 없으므로 지우기 전에 탭 패널로 옮겨 둔다.
    const [opener, setOpener] = useState<HTMLElement | null>(null);

    return (
        <>
            <TableRow className="cursor-pointer" onClick={onEdit}>
                <TableHead scope="row" className="font-normal">
                    {/* 줄(tr)은 버튼이 될 수 없어 키보드·스크린 리더에는 첫 칸을 편집 버튼으로 알린다.
                        따로 onClick을 달지 않는다. 누르면(Enter/Space 포함) click이 줄로 올라가 편집이 열린다. */}
                    <button type="button" title="수정"
                            className="block w-full cursor-pointer rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        {head}
                    </button>
                </TableHead>
                <TableCell className="whitespace-normal">{info}</TableCell>
                <TableCell className="text-muted-foreground">{formatUsed(used)}</TableCell>
                <TableCell className="text-right">
                    {/* 툴팁은 브라우저 기본(title)을 쓴다. 줄마다 툴팁 부품을 달면 수천 줄 목록을 열거나 검색할 때마다 느려진다. */}
                    <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label={`${label} 삭제`} title="삭제"
                            onClick={(ev) => {
                                ev.stopPropagation();
                                setOpener(ev.currentTarget);
                            }}>
                        <Trash2/>
                    </Button>
                </TableCell>
            </TableRow>
            {/* 확인 창은 줄(tr) 밖에 둔다. 창 안의 클릭이 줄로 올라가 편집이 열리지 않게 한다. */}
            {opener && (
                <ConfirmDialog
                    title={`"${label}" 삭제할까요?`}
                    confirmLabel="삭제"
                    danger
                    onConfirm={() => {
                        focusPanel(opener);
                        onRemove();
                        setOpener(null);
                    }}
                    onClose={() => setOpener(null)}
                />
            )}
        </>
    );
};

/**
 * 차단/메모 탭 공용 틀. 종류별 탭, 검색, 클립보드 내보내기/가져오기, 전체 삭제/추가, 빈 목록 안내, 표 머리를 그린다.
 * 줄(ListRow)은 row가 그린다.
 */
export const ListTabs = <T extends string, I>({
                                                  types,
                                                  names,
                                                  label,
                                                  columns,
                                                  emptyText,
                                                  exportData,
                                                  importData,
                                                  onClear,
                                                  onAdd,
                                                  toolbar,
                                                  items,
                                                  searchText,
                                                  galleryOf,
                                                  usedAt,
                                                  onRemoveMany,
                                                  row
                                              }: {
    types: readonly T[];
    names: Record<T, string>;
    /** "차단 목록", "메모" 등. 알림·확인 문구에 쓴다. */
    label: string;
    columns: [string, string];
    emptyText: (type: T) => string;
    exportData: () => unknown;
    /** 붙여넣은 JSON에서 가져온 종류 수를 돌려준다. 0이면 다른 데이터를 붙여넣은 것으로 보고 실패로 알린다. */
    importData: (parsed: Record<string, unknown>) => Promise<number>;
    onClear: (type: T) => Promise<void>;
    onAdd: (type: T) => void;
    /** 목록 위 왼쪽에 둘 도구(차단 탭의 기본 차단 모드). */
    toolbar: (type: T) => ReactNode;
    /** 저장된 순서(오래된 것부터) 그대로 준다. 표시할 때 뒤집는다. */
    items: (type: T) => readonly I[];
    /** 검색 대상 글자 (내용/유저/메모/갤러리 등). */
    searchText: (item: I) => (string | undefined)[];
    /** 갤러리 한정 항목의 갤러리 ID (없으면 모든 갤러리). 갤러리로 거를 때 쓴다. */
    galleryOf: (item: I) => string | undefined;
    /** 마지막으로 쓰인 시각 (useUsage). 오래 안 쓴 항목을 거를 때 쓴다. */
    usedAt: (type: T, item: I) => number | undefined;
    /** 걸러 보이는 항목을 한꺼번에 지운다. */
    onRemoveMany: (type: T, items: readonly I[]) => Promise<void>;
    row: (type: T, item: I) => ReactNode;
}) => {
    // 모든 탭이 같은 검색어를 쓴다. 탭 배지에 탭마다 걸린 개수가 보여 다른 탭에 있는지도 알 수 있다.
    const [query, setQuery] = useState("");
    const needle = query.trim().toLowerCase();
    // 갤러리 거르기: all(전체), common(모든 갤러리 항목), g:<ID>(그 갤러리 한정 항목). 검색어처럼 모든 탭이 같이 쓴다.
    const [gallery, setGallery] = useState("all");
    // 이만큼(일) 넘게 안 쓰인 항목만. 0이면 거르지 않는다.
    const [unusedDays, setUnusedDays] = useState("0");
    // 표에 그리는 줄 수. 거르는 조건이 바뀌면 처음 PAGE줄로 돌린다.
    const [limit, setLimit] = useState(PAGE);
    const galleries = [...new Set(types.flatMap((type) => items(type).map(galleryOf)).filter((id): id is string => Boolean(id)))].sort();
    const galleryOptions: Record<string, string> = {all: "모든 항목", common: "갤러리 공통", ...Object.fromEntries(galleries.map((id) => [`g:${id}`, id]))};
    // 고르던 갤러리의 항목을 다 지우면 선택지에서 빠지므로 전체로 돌린다.
    const galleryFilter = gallery in galleryOptions ? gallery : "all";
    const cutoff = Number(unusedDays) > 0 ? Date.now() - Number(unusedDays) * DAY : 0;
    const filtering = Boolean(needle) || galleryFilter !== "all" || cutoff > 0;

    const visible = (type: T, item: I): boolean => {
        if (needle && !searchText(item).some((text) => text?.toLowerCase().includes(needle))) return false;
        if (galleryFilter !== "all" && (galleryOf(item) ?? "") !== (galleryFilter === "common" ? "" : galleryFilter.slice(2))) return false;
        // 기록이 아직 없으면(옵션이 맞추기 전) 오래된 것으로 보지 않는다.
        return !cutoff || (usedAt(type, item) ?? Date.now()) < cutoff;
    };
    // 새 항목은 배열/객체 끝에 붙으므로 뒤집어 최신순으로 보여 준다(저장 순서는 그대로).
    // 종류마다 한 번만 걸러 탭 배지와 표가 같이 쓴다. total은 거르기 전 개수다.
    const shown = new Map(types.map((type) => {
        const all = items(type);
        return [type, {total: all.length, list: all.filter((item) => visible(type, item)).reverse()}];
    }));

    const [clearConfirm, setClearConfirm] = useState<T | null>(null);
    const [removeShownConfirm, setRemoveShownConfirm] = useState<T | null>(null);
    // 삭제를 확인하면 연 버튼이 사라지거나(보이는 항목 삭제) 막혀(전체 삭제) 확인 창이 포커스를 돌려줄 곳이 없다. 지우기 전에 탭 패널로 옮겨 둔다.
    // 확인 창은 창 밖으로 옮긴 포커스를 빼앗지 않는다 (useReturnFocus).
    const filterRow = useRef<HTMLDivElement>(null);
    const [importOpen, setImportOpen] = useState(false);
    const object = label + objectParticle(label);

    const exportList = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(exportData()));
            notify(`${object} 클립보드로 내보냈습니다.`);
        } catch {
            notify(`${object} 내보내지 못했습니다.`);
        }
    };

    const submitImport = async (text: string): Promise<string | undefined> => {
        let data: unknown;
        try {
            data = JSON.parse(text);
        } catch (e) {
            notify(`${object} 가져오지 못했습니다. ${friendlyMessage(e)}`);
            return;
        }

        try {
            if (isRecord(data) && (await importData(data)) > 0) return `${object} 가져왔습니다.`;
            // 데이터 탭의 전체 내보내기는 저장소 키(refresher:…)로 되어 있다.
            notify(isRecord(data) && Object.keys(data).some((key) => key.startsWith("refresher:"))
                ? "전체 데이터는 데이터 탭에서 가져와 주세요."
                : `${label} 데이터가 아닙니다. 이 탭에서 내보낸 JSON을 붙여 넣어 주세요.`);
        } catch {
            // 종류마다 따로 쓰므로 앞 종류는 이미 들어갔을 수 있다. 실패한 종류는 스토어가 되돌린다.
            notify(SAVE_FAILED);
        }
    };

    return (
        <Card>
            <CardContent>
                <Tabs defaultValue={types[0]}>
                    <div className="flex items-end gap-3">
                        <TabsList variant="line" className="h-auto flex-1 flex-wrap justify-start">
                            {types.map((type) => {
                                const {total, list} = shown.get(type)!;
                                return (
                                    <TabsTrigger key={type} value={type} className="flex-none">
                                        {names[type]}
                                        {total > 0 && (
                                            <Badge variant={filtering ? "default" : "secondary"}>
                                                {filtering ? `${list.length}/${total}` : total}
                                            </Badge>
                                        )}
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>
                        <div className="flex gap-1 pb-1">
                            <WithTooltip tip="클립보드로 내보내기" trigger={<Button variant="ghost" size="icon" aria-label="내보내기" onClick={() => void exportList()}/>}>
                                <Download/>
                            </WithTooltip>
                            <WithTooltip tip="가져오기" trigger={<Button variant="ghost" size="icon" aria-label="가져오기" onClick={() => setImportOpen(true)}/>}>
                                <Upload/>
                            </WithTooltip>
                        </div>
                    </div>

                    {types.map((type) => {
                        const {total, list} = shown.get(type)!;
                        return (
                            <TabsContent key={type} value={type} className="tab-enter">
                                <div ref={filterRow} className="flex flex-wrap items-center gap-2 pt-2">
                                    <RefresherSelect value={galleryFilter} options={galleryOptions} aria-label="갤러리" onChange={(value) => {
                                        setGallery(value);
                                        setLimit(PAGE);
                                    }}/>
                                    <RefresherSelect value={unusedDays} options={UNUSED_OPTIONS} aria-label="마지막 사용" onChange={(value) => {
                                        setUnusedDays(value);
                                        setLimit(PAGE);
                                    }}/>
                                    {filtering && list.length > 0 && (
                                        <Button variant="destructive" onClick={() => setRemoveShownConfirm(type)}>
                                            <Trash2 data-icon="inline-start"/> 보이는 {list.length}개 삭제
                                        </Button>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                                    {toolbar(type)}
                                    <div className="ml-auto flex flex-wrap gap-2">
                                        <InputGroup className="w-[180px]">
                                            <InputGroupAddon>
                                                <Search/>
                                            </InputGroupAddon>
                                            <InputGroupInput type="search" placeholder="검색" aria-label={`${label} 검색`} value={query}
                                                             onChange={(ev) => {
                                                                 setQuery(ev.target.value);
                                                                 setLimit(PAGE);
                                                             }}/>
                                        </InputGroup>
                                        {/* 검색 중에도 걸러진 것만이 아니라 이 종류 전부를 지우므로 확인 문구에 전체 개수를 적는다. */}
                                        <WithTooltip tip="전체 삭제" trigger={<Button variant="destructive" size="icon" aria-label="전체 삭제" disabled={total === 0}
                                                                                   onClick={() => setClearConfirm(type)}/>}>
                                            <Trash2/>
                                        </WithTooltip>
                                        <WithTooltip tip="추가" trigger={<Button size="icon" aria-label="추가" onClick={() => {
                                            // 검색어에 안 맞는 새 항목이 바로 숨어 추가가 안 된 것처럼 보이지 않게 검색어를 비운다.
                                            setQuery("");
                                            setLimit(PAGE);
                                            onAdd(type);
                                        }}/>}>
                                            <Plus/>
                                        </WithTooltip>
                                    </div>
                                </div>

                                {total === 0 ? (
                                    <EmptyList>{emptyText(type)}</EmptyList>
                                ) : list.length === 0 ? (
                                    <EmptyList>{needle ? `"${query.trim()}" 검색 결과 없음` : "조건에 맞는 항목 없음"}</EmptyList>
                                ) : (
                                    <>
                                        <div className="overflow-hidden rounded-lg border">
                                            <Table>
                                                <TableHeader className="bg-muted/50">
                                                    <TableRow>
                                                        <TableHead>{columns[0]}</TableHead>
                                                        <TableHead>{columns[1]}</TableHead>
                                                        <TableHead title="이 기기에서 마지막으로 걸리거나 보인 때">최근 사용</TableHead>
                                                        <TableHead className="w-12"/>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>{list.slice(0, limit).map((item) => row(type, item))}</TableBody>
                                            </Table>
                                        </div>
                                        {list.length > limit && (
                                            <div className="flex justify-center pt-4">
                                                <Button variant="outline" onClick={(ev) => {
                                                    // 마지막 묶음을 펼치면 버튼이 사라지므로 포커스를 탭 패널로 옮겨 둔다.
                                                    if (list.length <= limit + PAGE) focusPanel(ev.currentTarget);
                                                    setLimit(limit + PAGE);
                                                }}>
                                                    더 보기 (+{Math.min(PAGE, list.length - limit)})
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </TabsContent>
                        );
                    })}
                </Tabs>
            </CardContent>

            {clearConfirm && (
                <ConfirmDialog
                    title={`${names[clearConfirm]} ${object} 모두(${items(clearConfirm).length}개) 삭제할까요?`}
                    confirmLabel="삭제"
                    danger
                    onConfirm={() => {
                        focusPanel(filterRow.current);
                        onClear(clearConfirm).catch(() => notify(`${object} 삭제하지 못했습니다.`));
                        setClearConfirm(null);
                    }}
                    onClose={() => setClearConfirm(null)}
                />
            )}

            {removeShownConfirm && (
                <ConfirmDialog
                    title={`보이는 ${names[removeShownConfirm]} ${object} ${shown.get(removeShownConfirm)!.list.length}개 삭제할까요?`}
                    confirmLabel="삭제"
                    danger
                    onConfirm={() => {
                        focusPanel(filterRow.current);
                        onRemoveMany(removeShownConfirm, shown.get(removeShownConfirm)!.list).catch(() => notify(`${object} 삭제하지 못했습니다.`));
                        setRemoveShownConfirm(null);
                    }}
                    onClose={() => setRemoveShownConfirm(null)}
                />
            )}

            {importOpen && <ImportDialog title={`${label} 가져오기`} onClose={() => setImportOpen(false)} onSubmit={submitImport}/>}
        </Card>
    );
};

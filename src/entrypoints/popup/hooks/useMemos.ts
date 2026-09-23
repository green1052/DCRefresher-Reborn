import {memoStorage, MEMO_TYPES} from "@/storage/wxtStorage";
import {TYPE_NAMES as MEMO_TYPE_NAMES, normalizeMemoMap, watchMemoStorages} from "@/core/memo";
import {sendMessage} from "@/http/messaging";
import {useEffect, useState} from "react";
import {copyToClipboard, parseImportData} from "../utils/io";
import {ui} from "../../options/components/UiService";

export function useMemos() {
    const [memos, setMemos] = useState<{ [key in RefresherMemoType]: { [key: string]: RefresherMemoValue } }>({
        UID: {},
        NICK: {},
        IP: {}
    });

    useEffect(() => {
        return watchMemoStorages((type, loaded) => {
            setMemos((prev) => ({...prev, [type]: loaded}));
        });
    }, []);

    // 메모 입력창은 현재 보고 있는 탭에서만 떠야 한다. 브로드캐스트하면 열려 있는
    // 모든 디시 탭에서 창이 뜨고, 각각이 따로 저장돼버림.
    const requestMemoAsk = async (type: RefresherMemoType, user: string) => {
        const [tab] = await browser.tabs.query({active: true, currentWindow: true});

        // 유저 정보 모듈이 붙는 페이지(/board/view, /board/lists)에서만 메모 창이 뜬다.
        if (!tab?.id || !/^https:\/\/gall\.dcinside\.com\/(.*\/)?board\/(view|lists)/.test(tab.url ?? "")) {
            ui.alert("디시인사이드 게시판(글 목록 / 글 보기) 탭에서 사용해주세요.");
            return;
        }

        // ponytail: 응답은 사용자가 창을 닫아야 오므로 기다리지 않는다.
        sendMessage("refresherRequestMemoAsk", {type, user}, tab.id).catch(() => {
        });
    };

    // 팝업이 열려 있는 동안 콘텐츠 탭에서도 메모가 바뀐다. 스토리지 최신값을 읽어 반영한다.
    // setMemos는 watcher가 setValue를 반영하기 전까지 즉시 반응용으로 유지.
    const removeMemoUser = async (type: RefresherMemoType, user: string) => {
        const next = normalizeMemoMap(await memoStorage[type].getValue());
        delete next[user];
        setMemos((prev) => ({...prev, [type]: next}));
        await memoStorage[type].setValue(next);
    };

    const removeAllMemoUser = async (type: RefresherMemoType) => {
        if (!(await ui.confirm(`${MEMO_TYPE_NAMES[type]} 메모를 모두 삭제할까요?`))) return;
        setMemos((prev) => ({...prev, [type]: {}}));
        await memoStorage[type].setValue({});
    };

    const addMemoUser = async (type: RefresherMemoType) => {
        const user = await ui.prompt("메모 대상을 입력하세요.");

        if (!user) return;

        await requestMemoAsk(type, user);
    };

    const editMemoUser = async (type: RefresherMemoType, user: string) => {
        await requestMemoAsk(type, user);
    };

    const exportMemo = () => copyToClipboard(memos);

    const importMemo = async () => {
        const data = await parseImportData(`예시: {"UID":{},"NICK":{},"IP":{}}`);
        if (!data) return;

        for (const [key, value] of Object.entries(data)) {
            if (!(MEMO_TYPES as readonly string[]).includes(key)) continue;

            const type = key as RefresherMemoType;
            // confirm 대화상자 동안에도 다른 탭이 쓸 수 있으므로 타입마다 최신값을 읽는다.
            const target = normalizeMemoMap(await memoStorage[type].getValue());
            const importedMemos = normalizeMemoMap(value);

            for (const [id, memo] of Object.entries(importedMemos)) {
                if (target[id] && !(await ui.confirm(`${id}에 대한 메모가 이미 존재합니다. 덮어쓰시겠습니까?`))) {
                    continue;
                }

                target[id] = memo;
            }

            setMemos((prev) => ({...prev, [type]: target}));
            await memoStorage[type].setValue(target);
        }

        ui.alert("가져오기에 성공했습니다.");
    };

    return {
        memos,
        memoKeyNames: MEMO_TYPE_NAMES,
        memoTypes: MEMO_TYPES,
        removeMemoUser,
        removeAllMemoUser,
        addMemoUser,
        editMemoUser,
        exportMemo,
        importMemo
    };
}

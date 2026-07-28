import {MEMO_TYPES, memoStorage} from "@/storage/wxtStorage";
import {normalizeMemoMap, TYPE_NAMES as MEMO_TYPE_NAMES} from "@/core/memo";
import {sendMessage} from "@/http/messaging";
import {onMounted, reactive} from "vue";
import {copyToClipboard, parseImportData} from "../utils/io";

export function useMemos() {
    const memos = reactive<{ [key in RefresherMemoType]: { [key: string]: RefresherMemoValue } }>({
        UID: {},
        NICK: {},
        IP: {}
    });

    onMounted(async () => {
        await Promise.all(
            MEMO_TYPES.map(async (type) => {
                memos[type] = normalizeMemoMap(await memoStorage[type].getValue());

                memoStorage[type].watch((newValue) => {
                    memos[type] = normalizeMemoMap(newValue);
                });
            })
        );
    });

    // 메모 입력창은 현재 보고 있는 탭에서만 떠야 한다. 브로드캐스트하면 열려 있는
    // 모든 디시 탭에서 창이 뜨고, 각각이 따로 저장돼버림.
    const requestMemoAsk = async (type: RefresherMemoType, user: string) => {
        const [tab] = await browser.tabs.query({active: true, currentWindow: true});

        // 유저 정보 모듈이 붙는 페이지(/board/view, /board/lists)에서만 메모 창이 뜬다.
        if (!tab?.id || !/^https:\/\/gall\.dcinside\.com\/(.*\/)?board\/(view|lists)/.test(tab.url ?? "")) {
            alert("디시인사이드 게시판(글 목록 / 글 보기) 탭에서 사용해주세요.");
            return;
        }

        // ponytail: 응답은 사용자가 창을 닫아야 오므로 기다리지 않는다.
        sendMessage("refresherRequestMemoAsk", {type, user}, tab.id).catch(() => {
        });
    };

    const removeMemoUser = async (type: RefresherMemoType, user: string) => {
        delete memos[type][user];
        await memoStorage[type].setValue(JSON.parse(JSON.stringify(memos[type])));
    };

    const removeAllMemoUser = async (type: RefresherMemoType) => {
        if (!confirm(`${MEMO_TYPE_NAMES[type]} 메모를 모두 삭제할까요?`)) return;
        memos[type] = {};
        await memoStorage[type].setValue({});
    };

    const addMemoUser = async (type: RefresherMemoType) => {
        const user = prompt("메모 대상을 입력하세요.");

        if (!user) return;

        await requestMemoAsk(type, user);
    };

    const editMemoUser = async (type: RefresherMemoType, user: string) => {
        await requestMemoAsk(type, user);
    };

    const exportMemo = () => copyToClipboard(memos);

    const importMemo = async () => {
        const data = parseImportData(`예시: {"UID":{},"NICK":{},"IP":{}}`);
        if (!data) return;

        for (const [key, value] of Object.entries(data)) {
            if (!(MEMO_TYPES as readonly string[]).includes(key)) continue;

            const type = key as RefresherMemoType;
            const target = memos[type];
            const importedMemos = normalizeMemoMap(value);

            for (const [id, memo] of Object.entries(importedMemos)) {
                if (target[id] && !confirm(`${id}에 대한 메모가 이미 존재합니다. 덮어쓰시겠습니까?`)) {
                    continue;
                }

                target[id] = memo;
            }

            await memoStorage[type].setValue(JSON.parse(JSON.stringify(target)));
        }

        alert("가져오기에 성공했습니다.");
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

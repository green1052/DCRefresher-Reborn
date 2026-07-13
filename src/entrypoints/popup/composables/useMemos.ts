import {MEMO_TYPES, memoStorage} from "@/storage/wxtStorage";
import {TYPE_NAMES as MEMO_TYPE_NAMES} from "@/core/memo";
import {sendMessage} from "@/http/messaging";
import {onMounted, reactive} from "vue";
import {copyToClipboard, normalizeMemoImportMap, parseImportData} from "../utils/io";

const memoKeyNames = MEMO_TYPE_NAMES;
const memoTypes = MEMO_TYPES;

export function useMemos() {
    const memos = reactive<{ [key in RefresherMemoType]: { [key: string]: RefresherMemoValue } }>({
        UID: {},
        NICK: {},
        IP: {}
    });

    onMounted(async () => {
        for (const type of MEMO_TYPES) {
            memos[type] = normalizeMemoImportMap(await memoStorage[type].getValue());

            memoStorage[type].watch((newValue) => {
                memos[type] = normalizeMemoImportMap(newValue);
            });
        }
    });

    const requestMemoAsk = async (type: RefresherMemoType, user: string) => {
        try {
            await sendMessage("broadcast", {
                type: "refresherRequestMemoAsk",
                data: {
                    type,
                    user
                }
            });
        } catch {
        }
    };

    const removeMemoUser = async (type: RefresherMemoType, user: string) => {
        delete memos[type][user];
        await memoStorage[type].setValue(memos[type]);
    };

    const removeAllMemoUser = async (type: RefresherMemoType) => {
        if (!confirm(`${memoKeyNames[type]} 메모를 모두 삭제할까요?`)) return;
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
            if (!(memoTypes as readonly string[]).includes(key)) continue;

            const type = key as RefresherMemoType;
            const target = memos[type];
            const importedMemos = normalizeMemoImportMap(value);

            for (const [id, memo] of Object.entries(importedMemos)) {
                if (target[id] && !confirm(`${id}에 대한 메모가 이미 존재합니다. 덮어쓰시겠습니까?`)) {
                    continue;
                }

                target[id] = memo;
            }

            await memoStorage[type].setValue({...target});
        }

        alert("가져오기에 성공했습니다.");
    };

    return {
        memos,
        memoKeyNames,
        memoTypes,
        removeMemoUser,
        removeAllMemoUser,
        addMemoUser,
        editMemoUser,
        exportMemo,
        importMemo
    };
}
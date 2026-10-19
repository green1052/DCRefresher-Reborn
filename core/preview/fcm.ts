import {isRecord} from "@/utils/record";

// 디시 /_js/fcm/app.js가 쓰는 Firebase(9.22.0) 앱과, SDK가 웹 푸시 토큰을 저장하는 IndexedDB.
const DATABASE = "firebase-messaging-database";
const STORE = "firebase-messaging-store";
const APP_ID = "1:847263058171:web:f8932168a3b61afbeac85e";

const result = <T>(request: IDBRequest<T>): Promise<T> =>
    new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

/**
 * 이 브라우저의 디시 웹 푸시(FCM) 토큰. 디시 페이지는 알림을 허용한 브라우저의 토큰을 모든 jQuery ajax 요청에 fcmToken 머리로 붙이고,
 * 서버는 그 브라우저를 댓글 알림 대상에서 뺀다. 미리보기 댓글도 붙여야 자기 글에 단 댓글의 알림이 자기에게 오지 않는다 (#279).
 * 페이지와 같은 출처의 IndexedDB에서 SDK가 저장한 토큰을 읽는다. 알림을 허용하지 않았거나 읽지 못하면 undefined다.
 */
export const fcmToken = async (): Promise<string | undefined> => {
    try {
        if (Notification.permission !== "granted") return;
        const open = indexedDB.open(DATABASE);
        // DB가 없으면 만들지 않는다. 버전 1의 빈 DB가 생기면 SDK가 저장소를 만들지 못한다 (upgrade가 버전 0에서만 만든다).
        open.onupgradeneeded = () => open.transaction?.abort();
        const db = await result(open);
        try {
            if (!db.objectStoreNames.contains(STORE)) return;
            const details: unknown = await result(db.transaction(STORE).objectStore(STORE).get(APP_ID));
            return isRecord(details) && typeof details.token === "string" && details.token ? details.token : undefined;
        } finally {
            db.close();
        }
    } catch {
        return;
    }
};

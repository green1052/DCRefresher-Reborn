import {createProxyService, registerService, type ProxyServiceKey} from "@webext-core/proxy-service";

import {http} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import {dbStorage} from "@/core/storage/items";

export interface DatabaseService {
    /** IP/밴 데이터베이스를 강제로 다시 내려받아 저장 */
    forceUpdate(): Promise<void>;
    lastUpdate(): Promise<number>;
}

export const DATABASE_SERVICE_KEY = "dcr:database" as ProxyServiceKey<DatabaseService>;

/** background 이외 컨텍스트에서 사용하는 프록시 */
export const DatabaseService: DatabaseService = createProxyService(DATABASE_SERVICE_KEY);

const impl: DatabaseService = {
    forceUpdate: async () => {
        const [version, ip, ban] = await Promise.all([
            http.get(urls.database.version).text(),
            http.get(urls.database.ip).json<Record<string, string>>(),
            http.get(urls.database.ban).json<Record<string, string[]>>()
        ]);

        await dbStorage.setValue({version, lastUpdate: Date.now(), ip, ban});
    },

    lastUpdate: async () => (await dbStorage.getValue()).lastUpdate
};

/** background에서만 호출. 등록 후 로컬 구현을 반환(프록시 왕복 회피) */
export const registerDatabaseService = (): DatabaseService => {
    registerService(DATABASE_SERVICE_KEY, impl);
    return impl;
};

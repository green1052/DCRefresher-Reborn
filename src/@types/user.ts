import type { Nullable } from "../utils/types";

export {};

declare global {
    class User {
        nick: string;
        id: Nullable<string>;
        ip_data: string;
        icon: Nullable<string>;
        type: number;
        __ip: Nullable<string>;
    }
}

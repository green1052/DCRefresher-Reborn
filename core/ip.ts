import {urls} from "./http/urls";

let data: Record<string, string> | null = null;
const listeners = new Set<() => void>();

const load = async (): Promise<void> => {
    if (data) return;
    try {
        data = await fetch(urls.database.ip).then((response) => response.json() as Promise<Record<string, string>>);
    } catch {
        data = {};
    }
    for (const listener of listeners) listener();
};

export const subscribeIsp = (listener: () => void): (() => void) => {
    listeners.add(listener);
    void load();
    return () => listeners.delete(listener);
};

export const getIsp = (ip: string): string | undefined => data?.[ip];

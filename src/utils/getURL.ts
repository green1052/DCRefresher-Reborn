import {runtime} from "webextension-polyfill";

export const getURL = (url: string): string => {
    return runtime.getURL(url);
};
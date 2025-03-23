import { runtime } from "webextension-polyfill";

export default (url: string): string => {
    return runtime.getURL(url);
};

import { runtime } from "webextension-polyfill";

export const getURL = (url: string): string => runtime.getURL(url);

export default getURL;

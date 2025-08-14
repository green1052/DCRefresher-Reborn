import browser from "webextension-polyfill";

export const getURL = (url: string): string => browser.runtime.getURL(url);

export default getURL;

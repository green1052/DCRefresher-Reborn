import ky from "ky";

const fetchFn: typeof fetch = import.meta.env.FIREFOX
    // @ts-ignore
    ? content.fetch
    : window.fetch;

export const contentFetch: typeof fetch = fetchFn;

export const client = ky.create({fetch: contentFetch});

export default client;
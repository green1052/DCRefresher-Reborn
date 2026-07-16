import ky from "ky";

const fetchFn: typeof fetch = import.meta.env.FIREFOX
    // @ts-ignore
    ? content.fetch.bind(content)
    : window.fetch.bind(window);

export const contentFetch: typeof fetch = fetchFn;

export const client = ky.create({fetch: contentFetch});

export default client;
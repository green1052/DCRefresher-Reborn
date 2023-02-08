export const rand = (): string =>
    Math.trunc((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);

export const uuid = (): string =>
    rand() +
    rand() +
    "-" +
    rand() +
    "-" +
    rand() +
    "-" +
    rand() +
    "-" +
    rand() +
    rand() +
    rand();

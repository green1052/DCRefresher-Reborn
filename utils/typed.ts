// 타입이 붙은 Object·Array 도우미. 내장 함수는 키를 string으로 넓히거나 includes가 타입을 좁히지 않는다.

/** 객체의 문자열 키 (심볼 제외, 숫자 키는 문자열로). */
type ObjectKeys<T extends object> = `${Exclude<keyof T, symbol>}`;

/** 키를 넓히지 않는 Object.keys. */
export const objectKeys = <T extends object>(value: T): ObjectKeys<T>[] => Object.keys(value) as ObjectKeys<T>[];

/** 키·값 타입을 지키는 Object.entries. */
export const objectEntries = <T extends object>(value: T): [ObjectKeys<T>, Required<T>[Extract<keyof T, string | number>]][] =>
    Object.entries(value) as [ObjectKeys<T>, Required<T>[Extract<keyof T, string | number>]][];

/** 키 타입을 지키는 Object.fromEntries. 개수를 모르는 배열에서 만들면 빠진 키가 있을 수 있어 선택 속성이다. */
export const objectFromEntries = <K extends PropertyKey, V>(entries: Iterable<readonly [K, V]>): Partial<Record<K, V>> =>
    Object.fromEntries(entries) as Partial<Record<K, V>>;

/** 배열에 있으면 그 원소 타입으로 좁히는 Array#includes. */
export const arrayIncludes = <T extends U, U>(array: readonly T[], item: U): item is T => array.includes(item as T);

export type Nullable<T> = T | null;
export type NullableProperties<O> = {
    [K in keyof O]: Nullable<O[K]>;
};
export type ObjectEnum<V extends string> = { [K in V]: K };

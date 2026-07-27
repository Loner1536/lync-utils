import Lync from "@rbxts/lync";
/**
 * The deep-partial diff shape `partialDeep` produces for a full-state type `T` with removal
 * sentinel `S` — mirrors the codec transform:
 *   array  -> Map<index, value | sentinel>   struct -> each field optional
 *   map    -> Map<key,   value | sentinel>   scalar -> unchanged
 */
export type Diff<T, S> = T extends ReadonlyArray<infer E> ? Map<string | number, Diff<E, S> | S> : T extends Map<infer K, infer V> ? Map<K, Diff<V, S> | S> : T extends object ? {
    [K in keyof T]?: Diff<T[K], S>;
} : T;
/**
 * Derive a deep-partial "diff" codec from a full-state codec:
 *   struct -> each field optional      (absent = unchanged)
 *   map    -> map(key, value|sentinel) (missing key = unchanged, sentinel = removed)
 *   array  -> auto-keyed map           (index diffs; pairs with array->map diffing)
 *   scalar -> unchanged
 *
 * `sentinel` marks a removed value in your diff format (e.g. charm-sync's `None`). The returned
 * codec is typed `Codec<Diff<T, S>>`, so the input's shape carries through. Requires a Lync build
 * that exposes `nullable`.
 */
export declare function partialDeep<T, S>(codec: Lync.Codec<T>, sentinel: S): Lync.Codec<Diff<T, S>>;

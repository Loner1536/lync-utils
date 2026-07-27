import Lync from "@rbxts/lync";

// Lync's private codec shape we introspect. If a Lync release renames these, this is the one spot.
interface Node {
    _schema?: Record<string, Lync.Codec<unknown>>;
    _isMap?: boolean;
    _keyCodec?: Lync.Codec<unknown>;
    _valueCodec?: Lync.Codec<unknown>;
    _isArray?: boolean;
    _element?: Lync.Codec<unknown>;
}

/**
 * The deep-partial diff shape `partialDeep` produces for a full-state type `T` with removal
 * sentinel `S` — mirrors the codec transform:
 *   array  -> Map<index, value | sentinel>   struct -> each field optional
 *   map    -> Map<key,   value | sentinel>   scalar -> unchanged
 */
export type Diff<T, S> = T extends ReadonlyArray<infer E>
    ? Map<string | number, Diff<E, S> | S>
    : T extends Map<infer K, infer V>
        ? Map<K, Diff<V, S> | S>
        : T extends object
            ? { [K in keyof T]?: Diff<T[K], S> }
            : T;

function build(codec: Lync.Codec<unknown>, sentinel: unknown): Lync.Codec<unknown> {
    const n = codec as unknown as Node;
    if (n._schema !== undefined) {
        const schema: Record<string, Lync.Codec<unknown>> = {};
        for (const [key, inner] of n._schema as unknown as Map<string, Lync.Codec<unknown>>)
            schema[key] = Lync.optional(build(inner, sentinel));
        return Lync.struct(schema);
    }
    if (n._isMap === true) return Lync.map(n._keyCodec!, Lync.nullable(build(n._valueCodec!, sentinel), sentinel));
    if (n._isArray === true) return Lync.map(Lync.auto, Lync.nullable(build(n._element!, sentinel), sentinel));
    return codec;
}

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
export function partialDeep<T, S>(codec: Lync.Codec<T>, sentinel: S): Lync.Codec<Diff<T, S>> {
    return build(codec, sentinel) as unknown as Lync.Codec<Diff<T, S>>;
}

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
 * Derive a deep-partial "diff" codec from a full-state codec:
 *   struct -> each field optional      (absent = unchanged)
 *   map    -> map(key, value|sentinel) (missing key = unchanged, sentinel = removed)
 *   array  -> auto-keyed map           (index diffs; pairs with array->map diffing)
 *   scalar -> unchanged
 *
 * `sentinel` marks a removed value in your diff format (e.g. charm-sync's `None`).
 * Requires a Lync build that exposes `nullable`.
 */
export function partialDeep<S>(codec: Lync.Codec<unknown>, sentinel: S): Lync.Codec<unknown> {
    const n = codec as unknown as Node;
    if (n._schema !== undefined) {
        const schema: Record<string, Lync.Codec<unknown>> = {};
        for (const [key, inner] of n._schema as unknown as Map<string, Lync.Codec<unknown>>)
            schema[key] = Lync.optional(partialDeep(inner, sentinel));
        return Lync.struct(schema);
    }
    if (n._isMap === true) return Lync.map(n._keyCodec!, Lync.nullable(partialDeep(n._valueCodec!, sentinel), sentinel));
    if (n._isArray === true) return Lync.map(Lync.auto, Lync.nullable(partialDeep(n._element!, sentinel), sentinel));
    return codec;
}

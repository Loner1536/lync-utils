import Lync from "@rbxts/lync";
export type SerdesTable<T> = {
    bytespan?: number;
    includes_variants?: false;
    serialize: (value: T) => buffer;
    deserialize: (buf: buffer) => T;
} | {
    bytespan?: number;
    includes_variants: true;
    serialize: (value: T) => LuaTuple<[buffer, Array<defined> | undefined]>;
    deserialize: (buf: buffer, refs: Array<defined> | undefined) => T;
};
/**
 * Turn a Lync codec into a Replecs `SerdesTable`, so per-component wire
 * packing reuses Lync's own bit-packed encoders instead of hand-writing
 * buffer.write* calls for every component.
 *
 * Pass `{ refs: true }` for codecs that push Instance references (e.g.
 * `Lync.inst`) -- those can't live inside the buffer, so they ride
 * alongside it via Replecs' `includes_variants` channel instead. Plain
 * value codecs (numbers, vectors, structs/arrays/maps of those) don't need
 * the option.
 *
 * Delta codecs (`deltaInt`, `deltaVec3`, ...) are rejected: they keep
 * per-connection state and can't round-trip through a stateless
 * serialize/deserialize pair.
 *
 * Codecs with no fixed `_size` are rejected too: Lync only leaves `_size`
 * unset for `array`/`map` (or a struct/tuple containing one), which means
 * this value can grow/shrink one key at a time yet Replecs still resends
 * the WHOLE buffer on any change -- a footgun for things like a per-player
 * inventory map. Split that into its own entity/component per key so
 * Replecs' normal per-component change detection does the diffing instead.
 * Pass `{ unbounded: true }` to opt in anyway (e.g. a small settings map
 * that changes as a whole).
 */
export declare function replecsCodec<T>(codec: Lync.Codec<T>, opts?: {
    refs?: boolean;
    unbounded?: boolean;
}): SerdesTable<T>;

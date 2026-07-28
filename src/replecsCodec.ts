import Lync from "@rbxts/lync";

// Mirrors Lync's internal ChannelState (src/Types.luau) -- not part of the
// public Codec<T> type, but every codec's `write`/`read` runs against this
// shape at runtime. Lync's own unit tests build one by hand the same way
// (test/unit/codec/Base.spec.luau, InternalChannel.create()).
type ChannelState = {
    buff: buffer;
    cursor: number;
    size: number;
    refs: Array<Instance>;
    refCount: number;
    lastId: number;
    countPos: number;
    itemCount: number;
    singleMode: boolean;
    singlePos: number;
    deltas: Map<number, unknown>;
    prevDump: buffer | undefined;
    prevDumpLen: number;
    currentPacket: string | undefined;
};

type InternalCodec<T> = {
    write: (ch: ChannelState, value: T) => void;
    read: (src: buffer, pos: number, refs?: Array<Instance>) => LuaTuple<[T, number]>;
    _size?: number;
    _isDelta?: boolean;
    _hasDelta?: boolean;
};

const INITIAL_BUF = 64;

function createChannel(): ChannelState {
    return {
        buff: buffer.create(INITIAL_BUF),
        cursor: 0,
        size: INITIAL_BUF,
        refs: [],
        refCount: 0,
        lastId: -1,
        countPos: -1,
        itemCount: 0,
        singleMode: false,
        singlePos: 0,
        deltas: new Map(),
        prevDump: undefined,
        prevDumpLen: 0,
        currentPacket: undefined,
    };
}

function dump(ch: ChannelState): buffer {
    const out = buffer.create(ch.cursor);
    buffer.copy(out, 0, ch.buff, 0, ch.cursor);
    return out;
}

export type SerdesTable<T> =
    | {
          bytespan?: number;
          includes_variants?: false;
          serialize: (value: T) => buffer;
          deserialize: (buf: buffer) => T;
      }
    | {
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
export function replecsCodec<T>(
    codec: Lync.Codec<T>,
    opts?: { refs?: boolean; unbounded?: boolean },
): SerdesTable<T> {
    const internal = codec as unknown as InternalCodec<T>;

    if (internal._isDelta || internal._hasDelta) {
        error("replecsCodec: delta codecs keep per-connection state and can't be used as a component serdes -- use a non-delta codec");
    }

    if (internal._size === undefined && !(opts && opts.unbounded)) {
        error(
            "replecsCodec: codec has no fixed size (contains an array/map somewhere) -- any change resends the whole value. " +
                "Split growable keys into their own component/entity, or pass { unbounded: true } to opt in anyway.",
        );
    }

    if (opts && opts.refs) {
        return {
            bytespan: internal._size,
            includes_variants: true,
            serialize: (value: T) => {
                const ch = createChannel();
                internal.write(ch, value);
                return $tuple(dump(ch), ch.refCount > 0 ? (ch.refs as unknown as Array<defined>) : undefined);
            },
            deserialize: (buf: buffer, refs: Array<defined> | undefined) => {
                const [value] = internal.read(buf, 0, refs as unknown as Array<Instance> | undefined);
                return value;
            },
        };
    }

    return {
        bytespan: internal._size,
        serialize: (value: T) => {
            const ch = createChannel();
            internal.write(ch, value);
            if (ch.refCount > 0) {
                error("replecsCodec: codec pushed refs; pass { refs: true } to replecsCodec(codec, opts)");
            }
            return dump(ch);
        },
        deserialize: (buf: buffer) => {
            const [value] = internal.read(buf, 0);
            return value;
        },
    };
}

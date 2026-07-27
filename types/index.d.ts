import Lync from "@rbxts/lync";

// roblox-ts typings mirroring the strict-Luau source in ../src.
// (init.luau returns a table, so this is an `export =` default.)

declare namespace LyncUtils {
    /**
     * Derive a deep-partial "diff" codec from a full-state codec:
     *   struct -> each field optional · map -> map(key, value|sentinel)
     *   array  -> auto-keyed map      · scalar -> unchanged
     * `sentinel` marks a removed value in your diff format.
     */
    function partialDeep<S>(codec: Lync.Codec<unknown>, sentinel: S): Lync.Codec<unknown>;

    /**
     * Build a charm-sync `SyncPayload[]` codec from ONE signal's full-state codec, so charm
     * replication is buffer-packed instead of `Lync.unknown`. Requires `CharmSync.config.fixArrays = true`.
     */
    function charmCodec<T>(stateCodec: Lync.Codec<T>): Lync.Codec<unknown>;

    /** `Lync.enum` from a table's keys, sorted for a stable client/server ordering. */
    function enumFromKeys(object: Record<string, unknown>): Lync.Codec<string>;
}

export = LyncUtils;

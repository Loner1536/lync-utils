import Lync from "@rbxts/lync";
/**
 * Build a charm-sync `SyncPayload[]` codec from ONE signal's full-state codec, so charm replication
 * is buffer-packed instead of riding `Lync.unknown`. Derives the deep-partial patch form.
 *
 * Requires `CharmSync.config.fixArrays = true` (array diffs must be index maps) and a Lync build
 * with `nullable`.
 */
export declare function charmCodec<T>(stateCodec: Lync.Codec<T>): Lync.Codec<unknown>;

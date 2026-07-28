import CharmSync from "@rbxts/charm-sync";
import Lync from "@rbxts/lync";
/**
 * Build a charm-sync `SyncPayload[]` codec from ONE signal's full-state codec, so charm replication
 * is buffer-packed instead of riding `Lync.unknown`. Derives the deep-partial patch form.
 *
 * Requires `CharmSync.config.fixArrays = true` (array diffs must be index maps) and a Lync build
 * with `nullable`.
 *
 * Not exported from the package barrel (`@rbxts/lync-utils`) on purpose: `require`ing this file
 * pulls in `@rbxts/charm-sync`, and most consumers of `replecsCodec`/`partialDeep`/`enumFromKeys`
 * don't have (or want) that dependency. Import it directly: `@rbxts/lync-utils/out/charmCodec`.
 */
export declare function charmCodec<T>(stateCodec: Lync.Codec<T>): Lync.Codec<Array<CharmSync.SyncPayload>>;

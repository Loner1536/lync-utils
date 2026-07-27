import CharmSync from "@rbxts/charm-sync";
import Lync from "@rbxts/lync";

import { partialDeep } from "./partialDeep";

// charm-sync's removal sentinel as a runtime value (it exports no `None` const, only nilToNone).
const None = CharmSync.patch.nilToNone(undefined);

/**
 * Build a charm-sync `SyncPayload[]` codec from ONE signal's full-state codec, so charm replication
 * is buffer-packed instead of riding `Lync.unknown`. Derives the deep-partial patch form.
 *
 * Requires `CharmSync.config.fixArrays = true` (array diffs must be index maps) and a Lync build
 * with `nullable`.
 */
export function charmCodec<T>(stateCodec: Lync.Codec<T>): Lync.Codec<Array<CharmSync.SyncPayload>> {
    const data = (inner: Lync.Codec<unknown>) => Lync.struct({ data: Lync.map(Lync.string, inner) });
    // We know this encodes SyncPayload[]; typing it so lets callers wire charm's connect/patch
    // with no casts. This is the one internal cast that removes casts at every call site.
    return Lync.array(
        Lync.tagged("type", {
            init: data(stateCodec),
            patch: data(Lync.nullable(partialDeep(stateCodec, None), None)),
        }),
    ) as unknown as Lync.Codec<Array<CharmSync.SyncPayload>>;
}

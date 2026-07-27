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
export function charmCodec<T>(stateCodec: Lync.Codec<T>): Lync.Codec<unknown> {
    const data = (inner: Lync.Codec<unknown>) => Lync.struct({ data: Lync.map(Lync.string, inner) });
    return Lync.array(
        Lync.tagged("type", {
            init: data(stateCodec),
            patch: data(Lync.nullable(partialDeep(stateCodec, None), None)),
        }),
    ) as Lync.Codec<unknown>;
}

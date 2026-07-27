import Lync from "@rbxts/lync";
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
export declare function partialDeep<S>(codec: Lync.Codec<unknown>, sentinel: S): Lync.Codec<unknown>;

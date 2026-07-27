# @rbxts/lync-utils

Typed [roblox-ts](https://roblox-ts.com) utilities for [Lync](https://github.com/Loner1536/lync) —
derive diff codecs, compress charm-sync payloads, and build enums.

```sh
npm i @rbxts/lync-utils
```

## Requirements

`partialDeep` and `charmCodec` need **`Lync.nullable(codec, sentinel)`** to encode a "value or
removed-marker" as a present entry. Upstream [`@axpecter/lync`](https://www.npmjs.com/package/@axpecter/lync)
(2.3.x) removed `nullable`, and its `custom` codec is fixed-size so it can't be rebuilt from the
public API. Use a Lync build that still exposes `nullable` — e.g.
[`Loner1536/lync`](https://github.com/Loner1536/lync):

```jsonc
// package.json
"@rbxts/lync": "github:Loner1536/lync#main"
```

`enumFromKeys` has no such requirement.

## Utilities

### `partialDeep(codec, sentinel)`
Derives a **deep-partial "diff" codec** from a full-state codec — the shape structural diffs take:

- `struct` → each field `optional` (absent = unchanged)
- `map` → `map(key, value | sentinel)` (missing key = unchanged, `sentinel` = removed)
- `array` → `map(auto, value | sentinel)` (index-keyed; pairs with array→map diffing)
- scalar → unchanged

`sentinel` is whatever value your diff format uses to mark a removal.

```ts
import { partialDeep } from "@rbxts/lync-utils";
import Lync from "@rbxts/lync";

const Player = Lync.struct({
    health: Lync.int(0, 100),
    items: Lync.map(Lync.string, Lync.int(0, 2 ** 31 - 1)),
});

const REMOVED = { __removed: true };
const PlayerDiff = partialDeep(Player, REMOVED);
// accepts { health: 90 } or { items: { potion: REMOVED } }
```

### `charmCodec(stateCodec)`
Builds a buffer-packed [charm-sync](https://github.com/littensy/charm) `SyncPayload[]` codec from
one signal's full-state codec — so charm replication compresses instead of riding `Lync.unknown`.
Requires `CharmSync.config.fixArrays = true`. Built on `partialDeep`.

```ts
import { charmCodec } from "@rbxts/lync-utils";
import CharmSync from "@rbxts/charm-sync";
import Lync from "@rbxts/lync";

CharmSync.config.fixArrays = true;

const Data = Lync.struct({
    rank: Lync.int(0, 255),
    items: Lync.map(Lync.string, Lync.int(0, 2 ** 31 - 1)),
});

// the playerData signal's state is { [userId]: Data }
const PatchCodec = charmCodec(Lync.map(Lync.string, Data));
const Patch = Lync.packet("Data-Patch", PatchCodec);

// server: forward charm-sync payloads through the codec
CharmSync.server.connect((player, payloads) => Patch.send(payloads as never, player));

// client
Patch.on((payloads) => CharmSync.client.patch(payloads as never));
```

> Charm-sync sends over `Lync.unknown` (roblox serialization) by default. Routing its payloads
> through `charmCodec` buffer-packs them — roughly **2–2.5x smaller** on typical player data, since
> string keys (`"playerData-…"`, `"stats"`, `"items"`) become compact field encoding.

### `enumFromKeys(object)`
`Lync.enum` from a table's keys, sorted for a stable client/server ordering.

```ts
import { enumFromKeys } from "@rbxts/lync-utils";

const CharacterId = enumFromKeys(Definitions.Characters); // Lync.enum("naruto", "sasuke", ...)
```

## Notes

- `partialDeep` reads Lync's private codec fields (`_schema`/`_isMap`/…). If a Lync release renames
  them, that function is the one place to update.

## Development

```sh
rotor build   # compile src/ -> out/
```

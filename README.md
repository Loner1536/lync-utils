# lync-utils

Typed utilities for [Lync](https://github.com/Loner1536/lync) — derive diff codecs, compress
charm-sync payloads, and build enums.

> **Why Luau?** These utilities were originally written in roblox-ts, then rewritten to strict
> Luau (with Claude's help) so that **Luau users get real types too** — Lync targets both Luau and
> roblox-ts, and compiled roblox-ts output is untyped for raw-Luau consumers. Authoring in Luau
> means the types travel with the source; a `.d.ts` (in `types/`) mirrors them for roblox-ts.

## Requirements

`partialDeep` and `charmCodec` need **`Lync.nullable(codec, sentinel)`** to encode a "value or
removed-marker" as a present entry. Upstream [`@axpecter/lync`](https://www.npmjs.com/package/@axpecter/lync)
(2.3.x) **removed** `nullable`, and its `custom` codec is fixed-size so it can't be rebuilt from the
public API. Until it's restored upstream, use a Lync build that still exposes `nullable` — e.g.
[`Loner1536/lync`](https://github.com/Loner1536/lync):

```jsonc
// roblox-ts (package.json)
"@rbxts/lync": "github:Loner1536/lync#main"
```

`enumFromKeys` has no such requirement.

## Install

**Luau (wally):**
```toml
[dependencies]
LyncUtils = "loner1536/lync-utils@0.1.0"
```

**roblox-ts (npm):**
```sh
npm i @rbxts/lync-utils
```

## Utilities

### `partialDeep(codec, sentinel)`
Derives a **deep-partial "diff" codec** from a full-state codec — the shape structural diffs take:

- `struct` → each field `optional` (absent = unchanged)
- `map` → `map(key, value | sentinel)` (missing key = unchanged, `sentinel` = removed)
- `array` → `map(auto, value | sentinel)` (index-keyed; pairs with array→map diffing)
- scalar → unchanged

`sentinel` is whatever value your diff format uses to mark a removal.

<details><summary>Luau</summary>

```lua
local LyncUtils = require(Packages.LyncUtils)
local Lync = require(Packages.Lync)

local Player = Lync.struct({
	health = Lync.int(0, 100),
	items = Lync.map(Lync.string, Lync.int(0, 2 ^ 31 - 1)),
})

local REMOVED = { __removed = true } -- your removal sentinel
local PlayerDiff = LyncUtils.partialDeep(Player, REMOVED)
-- PlayerDiff accepts { health = 90 } or { items = { potion = REMOVED } }
```
</details>

<details><summary>roblox-ts</summary>

```ts
import LyncUtils from "@rbxts/lync-utils";
import Lync from "@rbxts/lync";

const Player = Lync.struct({
    health: Lync.int(0, 100),
    items: Lync.map(Lync.string, Lync.int(0, 2 ** 31 - 1)),
});

const REMOVED = { __removed: true };
const PlayerDiff = LyncUtils.partialDeep(Player, REMOVED);
```
</details>

### `charmCodec(stateCodec)`
Builds a buffer-packed [charm-sync](https://github.com/littensy/charm) `SyncPayload[]` codec from
one signal's full-state codec — so charm replication compresses instead of riding `Lync.unknown`.
Requires `CharmSync.config.fixArrays = true`. Built on `partialDeep`.

<details><summary>Luau</summary>

```lua
local LyncUtils = require(Packages.LyncUtils)
local CharmSync = require(Packages.CharmSync)
local Lync = require(Packages.Lync)

CharmSync.config.fixArrays = true

local Data = Lync.struct({
	rank = Lync.int(0, 255),
	items = Lync.map(Lync.string, Lync.int(0, 2 ^ 31 - 1)),
})

-- signal state is { [userId]: Data }
local PatchCodec = LyncUtils.charmCodec(Lync.map(Lync.string, Data))
local Patch = Lync.packet("Data-Patch", PatchCodec)

-- server: forward charm-sync payloads through the codec
CharmSync.server.connect(function(player, payloads)
	Patch:send(payloads, player)
end)

-- client
Patch:on(function(payloads)
	CharmSync.client.patch(payloads)
end)
```
</details>

<details><summary>roblox-ts</summary>

```ts
import LyncUtils from "@rbxts/lync-utils";
import CharmSync from "@rbxts/charm-sync";
import Lync from "@rbxts/lync";

CharmSync.config.fixArrays = true;

const Data = Lync.struct({
    rank: Lync.int(0, 255),
    items: Lync.map(Lync.string, Lync.int(0, 2 ** 31 - 1)),
});

const PatchCodec = LyncUtils.charmCodec(Lync.map(Lync.string, Data));
const Patch = Lync.packet("Data-Patch", PatchCodec);

CharmSync.server.connect((player, payloads) => Patch.send(payloads as never, player));
Patch.on((payloads) => CharmSync.client.patch(payloads as never));
```
</details>

> Charm-sync sends over `Lync.unknown` (roblox serialization) by default. Routing its payloads
> through `charmCodec` buffer-packs them — roughly 2–2.5x smaller on typical player data, since the
> string keys (`"playerData-…"`, `"stats"`, `"items"`) are replaced with compact field encoding.

### `enumFromKeys(object)`
`Lync.enum` from a table's keys, sorted for a stable client/server ordering.

<details><summary>Luau</summary>

```lua
local CharacterId = LyncUtils.enumFromKeys(Definitions.Characters) -- Lync.enum("naruto", "sasuke", ...)
```
</details>

<details><summary>roblox-ts</summary>

```ts
const CharacterId = LyncUtils.enumFromKeys(Definitions.Characters);
```
</details>

## Development

```sh
luau-lsp analyze --platform=standard src/*.luau
```

`stubs/` provide minimal Lync/charm-sync type surfaces so the package typechecks without pulling
the real dependencies. Regenerate them (and `types/index.d.ts`) against the Lync rewrite when it lands.

> `partialDeep` reads Lync's private codec fields (`_schema`/`_isMap`/…). If a Lync release renames
> them, that function is the one place to update.

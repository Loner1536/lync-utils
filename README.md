# @rbxts/lync-utils

Typed [roblox-ts](https://roblox-ts.com) utilities for [Lync](https://github.com/Loner1536/lync) —
derive diff codecs, compress charm-sync payloads, and build enums.

> **Not published to npm — on purpose.** lync-utils itself is not a fork; it's a small utility
> package. But it depends on `Lync.nullable` (see [Requirements](#requirements)), which only exists
> on **[Loner1536/lync](https://github.com/Loner1536/lync)** — a fork of Lync (Lync is currently
> being rewritten, and the rewrite dropped `nullable`). Publishing a package that leans on a personal
> Lync fork to the shared `@rbxts` npm scope isn't the right thing to do, so this installs straight
> from GitHub instead. **You need that Lync fork** — see below.

## Install

Both this package **and** the Lync fork it needs go in your `package.json` under the `@rbxts` scope
(the import path must be `@rbxts/lync` / `@rbxts/lync-utils` for roblox-ts to resolve them):

```jsonc
// package.json
{
    "dependencies": {
        "@rbxts/lync": "github:Loner1536/lync#main",
        "@rbxts/lync-utils": "github:Loner1536/lync-utils#main",
        "@rbxts/charm-sync": "^0.4.0"
    }
}
```

```sh
npm install   # or bun install
```

The built Luau (`out/`) is committed, so nothing compiles on install.

## Requirements

`partialDeep` and `charmCodec` call **`Lync.nullable(codec, sentinel)`** — it encodes "a value **or**
a removed-marker" as a *present* entry (plain `optional`/nil can't: nil in a map means "key absent =
unchanged", not "removed"). Upstream [`@axpecter/lync`](https://www.npmjs.com/package/@axpecter/lync)
(2.3.x) **removed** `nullable`, and its `custom` codec is fixed-size so it can't be rebuilt from the
public API. That's why you need a fork that keeps it — [`Loner1536/lync`](https://github.com/Loner1536/lync).

`enumFromKeys` has no such requirement.

---

## `partialDeep(codec, sentinel)`

Derives a **deep-partial "diff" codec** from a full-state codec. It walks the codec and rewrites it
into the shape a structural diff takes:

| Full codec | Diff codec |
| --- | --- |
| `struct` | each field `optional` (absent field = unchanged) |
| `map` | `map(key, value \| sentinel)` (missing key = unchanged, `sentinel` = removed) |
| `array` | `map(auto, value \| sentinel)` (index-keyed; pairs with array→map diffing) |
| scalar | unchanged |

`sentinel` is whatever value your diff format uses to mark a removal. Fully generic —
`partialDeep<T, S>(codec: Codec<T>, sentinel: S)` returns `Codec<Diff<T, S>>`, so the input's shape
carries through to a precise diff type.

**Basic struct**
```ts
import { partialDeep } from "@rbxts/lync-utils";
import Lync from "@rbxts/lync";

const REMOVED = { __removed: true };

const Player = Lync.struct({
    health: Lync.int(0, 100),
    mana: Lync.int(0, 100),
});

const PlayerDiff = partialDeep(Player, REMOVED);
// encodes { health: 90 }  — mana omitted = unchanged
```

**Map with removals**
```ts
const Inventory = Lync.struct({
    items: Lync.map(Lync.string, Lync.int(0, 2 ** 31 - 1)),
});

const InventoryDiff = partialDeep(Inventory, REMOVED);
// encodes { items: { potion: 5 } }         — add/update "potion"
// encodes { items: { sword: REMOVED } }    — remove "sword"
// encodes {}                               — nothing changed
```

**Array (becomes index-keyed)**
```ts
const Squad = Lync.struct({ members: Lync.array(Lync.string) });
const SquadDiff = partialDeep(Squad, REMOVED);
// encodes { members: { "1": "naruto" } }   — index 1 changed
```

**Nested**
```ts
const Save = Lync.struct({
    rank: Lync.int(0, 255),
    stats: Lync.struct({
        level: Lync.struct({ current: Lync.int(0, 999), xp: Lync.int(0, 2 ** 31 - 1) }),
    }),
    items: Lync.map(Lync.string, Lync.int(0, 999)),
});

const SaveDiff = partialDeep(Save, REMOVED);
// encodes { stats: { level: { xp: 1200 } } }  — only xp; siblings untouched
```

**Using charm-sync's `None` as the sentinel** (what `charmCodec` does internally)
```ts
import CharmSync from "@rbxts/charm-sync";
const None = CharmSync.patch.nilToNone(undefined);
const codec = partialDeep(Save, None);
```

---

## `charmCodec(stateCodec)`

Builds a buffer-packed [charm-sync](https://github.com/littensy/charm) `SyncPayload[]` codec from one
signal's full-state codec, so charm replication compresses instead of riding `Lync.unknown` (roblox
serialization). Built on `partialDeep` with charm's `None` as the sentinel.

- Needs `CharmSync.config.fixArrays = true` so array diffs are index maps (not sparse arrays, which
  Lync's dense array codec can't encode). **This is charm-sync's default** — you only need to act if
  you explicitly set it to `false`.
- The signal state is whatever your getter returns — commonly `{ [userId]: Data }`.

**Full server + client setup**
```ts
import { charmCodec } from "@rbxts/lync-utils";
import CharmSync from "@rbxts/charm-sync";
import Lync from "@rbxts/lync";

CharmSync.config.fixArrays = true; // default true — only needed if you disabled it

const Data = Lync.struct({
    rank: Lync.int(0, 255),
    stats: Lync.struct({ level: Lync.int(0, 999), xp: Lync.int(0, 2 ** 31 - 1) }),
    items: Lync.map(Lync.string, Lync.int(0, 2 ** 31 - 1)),
});

// signal state is { [userId]: Data }
const PatchCodec = charmCodec(Lync.map(Lync.string, Data));
const Patch = Lync.packet("PlayerData-Patch", PatchCodec);

// --- server --- (no casts: charmCodec is typed Codec<SyncPayload[]>, matching connect/patch)
CharmSync.server.connect((player, payloads) => Patch.send(payloads, player));

// --- client ---
Patch.on((payloads) => CharmSync.client.patch(payloads));
```

**Signal state that isn't user-keyed** — `charmCodec` just needs the state codec, whatever its shape:
```ts
// a single global config signal: state is the object itself
const Config = Lync.struct({ doubleXpEnabled: Lync.bool, eventId: Lync.int(0, 2 ** 16 - 1) });
const ConfigPatch = Lync.packet("Config-Patch", charmCodec(Config));
```

> **Why it compresses:** charm's default `Lync.unknown` sends roblox-serialized tables — every number
> is 9 bytes and every key is a string (`"playerData-…"`, `"stats"`, `"items"`). `charmCodec` packs
> numbers into 1–4 bytes and drops the string keys, ~**2–2.5x smaller** on typical player data.

---

## `enumFromKeys(object)`

`Lync.enum` from a table's keys, sorted so client and server agree on the ordering. The everyday
"enum from a definitions table" pattern in one call. The **key union carries through** —
`enumFromKeys<T>(object: T)` returns `Codec<keyof T & string>`.

```ts
import { enumFromKeys } from "@rbxts/lync-utils";
import Lync from "@rbxts/lync";

const CharacterDefs = { naruto: {}, sasuke: {}, sakura: {} };

const CharacterId = enumFromKeys(CharacterDefs); // Codec<"naruto" | "sasuke" | "sakura">, sorted

// use it like any codec — e.g. as a map key
const Team = Lync.map(CharacterId, Lync.int(0, 100)); // per-character value
```

---

## Notes

- `partialDeep` reads Lync's private codec fields (`_schema` / `_isMap` / `_isArray` / …). If a Lync
  release renames them, that function is the one place to update.

## Development

```sh
rotor build   # compile src/ -> out/  (out/ is committed for GitHub installs)
```

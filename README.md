# @rbxts/lync-utils

Typed [roblox-ts](https://roblox-ts.com) utilities for [Lync](https://github.com/Loner1536/lync) —
derive diff codecs, compress charm-sync payloads, pack Replecs components, and build enums.

> **Not published to npm — on purpose.** lync-utils itself is not a fork; it's a small utility
> package. But it depends on `Lync.nullable` (see [Requirements](#requirements)), which a Lync update
> removed and only lives on **[Loner1536/lync](https://github.com/Loner1536/lync)** — a fork that
> keeps it. (Lync is also being rewritten separately; that's not what dropped `nullable`.) Publishing
> a package that leans on a personal Lync fork to the shared `@rbxts` npm scope isn't the right thing
> to do, so this installs straight from GitHub instead. **You need that Lync fork** — see below.

## Install

Both this package **and** the Lync fork it needs go in your `package.json` under the `@rbxts` scope
(the import path must be `@rbxts/lync` / `@rbxts/lync-utils` for roblox-ts to resolve them):

```jsonc
// package.json
{
    "dependencies": {
        "@rbxts/lync": "github:Loner1536/lync#main",
        "@rbxts/lync-utils": "github:Loner1536/lync-utils#main"
    }
}
```

```sh
npm install   # or bun install
```

The built Luau (`out/`) is committed, so nothing compiles on install.

`@rbxts/lync` and `@rbxts/charm-sync` come along as dependencies of this package (`charmCodec`
needs charm-sync). `@rbxts/replecs` is **not** a dependency — `replecsCodec` is duck-typed against
Replecs' serdes shape without importing it, so add it yourself if you use `replecsCodec`.

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

## `replecsCodec(codec, opts?)`

Turns a Lync codec into a [Replecs](https://github.com/PepeElToro41/replecs) component `SerdesTable`,
so per-component wire packing reuses Lync's own bit-packed encoders instead of hand-writing
`buffer.write*` calls for every component. Only depends on `@rbxts/lync` — no `@rbxts/replecs`
import, the return shape just duck-types Replecs' `serdes` interface.

```ts
// shared/components.ts
import { world } from "@rbxts/jecs";
import replecs from "@rbxts/replecs";
import Lync from "@rbxts/lync";
import { replecsCodec } from "@rbxts/lync-utils";

export const components = {
    health: world.component<number>(),
    transform: world.component<Vector2>(),
    owner: world.component<Player>(),
};

world.set(components.health, replecs.serdes, replecsCodec(Lync.int(0, 999)));
world.set(components.transform, replecs.serdes, replecsCodec(Lync.vect2));
world.set(components.owner, replecs.serdes, replecsCodec(Lync.inst, { refs: true }));
```

- Pass `{ refs: true }` for codecs that push `Instance`s (`Lync.inst`) — they can't live inside the
  buffer, so they ride alongside it via Replecs' `includes_variants` channel instead.
- Rejects **delta codecs** (`Lync.deltaInt`, `Lync.deltaVec3`, ...) at call time. They keep
  per-connection diff state, but Replecs' `serialize(value)` never says *which entity* it's
  serializing — one serdes instance is shared by every entity holding that component — so there's no
  safe key to store that per-entity delta state under. This applies transitively: an `optional`/
  `tagged` wrapping a delta codec is rejected too.
- Rejects **unbounded codecs** (anything containing `Lync.array`/`Lync.map`, checked via Lync's own
  `_size` — nil for anything variable-length, transitively through `struct`/`tuple`) unless you pass
  `{ unbounded: true }`. See [What not to do](#what-not-to-do-with-replecscodec) below for why.

### What not to do with `replecsCodec`

**Growable map/array, expecting partial updates**
```ts
const inventory = Lync.struct({
    items: Lync.map(Lync.string, Lync.int(0, 2 ** 31 - 1)),
});

world.set(components.inventory, replecs.serdes, replecsCodec(inventory));
// throws: "codec has no fixed size (contains an array/map somewhere)"
```
Replecs calls `serdes.serialize(value)` with the *whole new value* whenever jecs sees the component
change — there's no old-value diffing at this layer (unlike `charmCodec`, which owns the diff
itself). Adding one potion would re-encode and resend every item in the map. Forcing it through:
```ts
replecsCodec(inventory, { unbounded: true }); // compiles, but 1 new item = whole map resent
```
Do this instead — give each item its own component/entity so Replecs' normal per-component change
detection diffs it for free:
```ts
const itemSlot = world.component<{ id: string; count: number }>();
// one entity per inventory slot; changing slot 3 only ever touches slot 3
world.set(slotEntity, itemSlot, { id: "potion", count: 5 });
world.set(itemSlot, replecs.serdes, replecsCodec(Lync.struct({ id: Lync.string, count: Lync.int(0, 999) })));
```

**Reaching for `Lync.unknown`**
```ts
world.set(components.settings, replecs.serdes, replecsCodec(Lync.unknown));
// throws: same unbounded-codec error -- Lync.unknown has no _size
```
It roblox-serializes the value — the exact cost `replecsCodec`/`charmCodec` both exist to avoid.
Write a real codec for the shape instead:
```ts
replecsCodec(Lync.struct({ musicVolume: Lync.float(0, 1), sfxEnabled: Lync.bool }));
```

**Delta codec passed straight through**
```ts
world.set(components.transform, replecs.serdes, replecsCodec(Lync.deltaVec3));
// throws: "delta codecs keep per-connection state..."
```
There's no way to opt out of this one. `Lync.deltaVec3` keeps its diff cache keyed by a channel that
Replecs never associates with a specific entity, so letting it through would silently mix entity A's
delta state into entity B's. Use the plain codec instead:
```ts
replecsCodec(Lync.vect3);
```

**Using it where Replecs' own `custom_id` prediction belongs**
```ts
// wrong: trying to "fix" client-predicted entity flicker by tweaking the serdes
world.set(components.projectile, replecs.serdes, replecsCodec(Lync.struct({ owner: Lync.inst }), { refs: true }));
// serdes only controls wire packing -- it has no say over entity identity/prediction
```
Entity prediction/reconciliation is Replecs' `custom_id` + `apply_updates` mechanism, a different
layer entirely. Wrapping a codec differently won't change how predicted entities get claimed or
merged — see Replecs' own `custom_id` docs for that problem.

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

# lync-utils

Typed utilities for [Lync](https://github.com/Loner1536/lync). Authored in strict Luau; ships
roblox-ts typings in `types/` (add when publishing).

## Utilities

### `partialDeep(codec, sentinel)`
Derives a **deep-partial "diff" codec** from a full-state codec — the shape structural diffs take:

- `struct` → each field `optional` (absent = unchanged)
- `map` → `map(key, value | sentinel)` (missing key = unchanged, `sentinel` = removed)
- `array` → `map(auto, value | sentinel)` (index-keyed; pairs with array→map diffing)
- scalar → unchanged

`sentinel` is whatever your diff format uses to mark a removal.

> Reads Lync's private codec fields (`_schema`/`_isMap`/…). If a Lync release renames them,
> `partialDeep` is the one place to update.

### `charmCodec(stateCodec)`
Builds a buffer-packed [charm-sync](https://github.com/littensy/charm) `SyncPayload[]` codec from
one signal's full-state codec — so charm replication compresses instead of riding `Lync.unknown`.
Requires `CharmSync.config.fixArrays = true`. Built on `partialDeep`.

```lua
local LyncUtils = require(path.to["lync-utils"])

local Data = Lync.struct({ ... })
local codec = LyncUtils.charmCodec(Lync.map(Lync.string, Data))
local Patch = Lync.packet("Data-Patch", codec)
```

### `enumFromKeys(object)`
`Lync.enum` from a table's keys, sorted for a stable client/server ordering.

## Development

```sh
luau-lsp analyze --platform=standard src/*.luau
```

`stubs/` provide minimal Lync/charm-sync type surfaces so the package typechecks without pulling
the real dependencies. Regenerate them against the Lync rewrite when it lands.

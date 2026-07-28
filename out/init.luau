-- Compiled with rotor v2.2.1
local TS = _G[script]
local exports = {}
-- Barrel only re-exports utilities that need Lync alone. `charmCodec` pulls in
-- `@rbxts/charm-sync` at require-time, so it's intentionally NOT here -- import it
-- directly from `@rbxts/lync-utils/out/charmCodec` if you use charm-sync.
exports.partialDeep = TS.import(script, script, "partialDeep").partialDeep
exports.replecsCodec = TS.import(script, script, "replecsCodec").replecsCodec
exports.enumFromKeys = TS.import(script, script, "enumFromKeys").enumFromKeys
return exports

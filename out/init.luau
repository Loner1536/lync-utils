-- Compiled with rotor v2.2.1
local TS = _G[script]
local exports = {}
exports.partialDeep = TS.import(script, script, "partialDeep").partialDeep
exports.replecsCodec = TS.import(script, script, "replecsCodec").replecsCodec
exports.enumFromKeys = TS.import(script, script, "enumFromKeys").enumFromKeys
-- Pulls in `@rbxts/charm-sync` at require-time -- optional peer dep, see package.json.
exports.charmCodec = TS.import(script, script, "charmCodec").charmCodec
return exports

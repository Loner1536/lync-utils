-- Compiled with rotor v2.2.1
local TS = _G[script]
local CharmSync = TS.import(script, TS.getModule(script, "@rbxts", "charm-sync").src)
local Lync = TS.import(script, TS.getModule(script, "@rbxts", "lync"))
local partialDeep = TS.import(script, script.Parent, "partialDeep").partialDeep
-- charm-sync's removal sentinel as a runtime value (it exports no `None` const, only nilToNone).
local None = CharmSync.patch.nilToNone(nil)
--[[
	*
	 * Build a charm-sync `SyncPayload[]` codec from ONE signal's full-state codec, so charm replication
	 * is buffer-packed instead of riding `Lync.unknown`. Derives the deep-partial patch form.
	 *
	 * Requires `CharmSync.config.fixArrays = true` (array diffs must be index maps) and a Lync build
	 * with `nullable`.
	 
]]
local function charmCodec(stateCodec)
	local data = function(inner)
		return Lync.struct({
			data = Lync.map(Lync.string, inner),
		})
	end
	return Lync.array(Lync.tagged("type", {
		init = data(stateCodec),
		patch = data(Lync.nullable(partialDeep(stateCodec, None), None)),
	}))
end
return {
	charmCodec = charmCodec,
}

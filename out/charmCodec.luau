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
	 *
	 * Pulls in `@rbxts/charm-sync` at require-time -- an optional peer dependency of this package,
	 * add it yourself if you use `charmCodec`.
	 
]]
local function charmCodec(stateCodec)
	local data = function(inner)
		return Lync.struct({
			data = Lync.map(Lync.string, inner),
		})
	end
	-- We know this encodes SyncPayload[]; typing it so lets callers wire charm's connect/patch
	-- with no casts. This is the one internal cast that removes casts at every call site.
	return Lync.array(Lync.tagged("type", {
		init = data(stateCodec),
		patch = data(Lync.nullable(partialDeep(stateCodec, None), None)),
	}))
end
return {
	charmCodec = charmCodec,
}

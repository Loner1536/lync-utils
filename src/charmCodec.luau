--!strict
local CharmSync = require("@pkg/charm-sync")
local Lync = require("@pkg/lync")
local partialDeep = require("@self/partialDeep")

type Codec<T> = Lync.Codec<T>

-- charm-sync's removal sentinel as a runtime value (it exports no None const, only nilToNone).
local None = CharmSync.patch.nilToNone(nil)

--[[
	Build a charm-sync SyncPayload[] codec from ONE signal's full-state codec, so the wire is
	buffer-packed instead of Lync.unknown passthrough. Derives the deep-partial patch form.

	Requires CharmSync.config.fixArrays = true (array diffs must be index maps for Lync.map).
]]
local function charmCodec<T>(stateCodec: Codec<T>): Codec<any>
	local function data(inner: Codec<any>): Codec<any>
		return Lync.struct({ data = Lync.map(Lync.string, inner) })
	end

	return Lync.array(Lync.tagged("type", {
		init = data(stateCodec),
		patch = data(Lync.nullable(partialDeep(stateCodec, None), None)),
	}))
end

return charmCodec

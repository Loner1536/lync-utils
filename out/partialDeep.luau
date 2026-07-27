-- Compiled with rotor v2.2.1
local TS = _G[script]
local Lync = TS.import(script, TS.getModule(script, "@rbxts", "lync"))
-- Lync's private codec shape we introspect. If a Lync release renames these, this is the one spot.
--[[
	*
	 * Derive a deep-partial "diff" codec from a full-state codec:
	 *   struct -> each field optional      (absent = unchanged)
	 *   map    -> map(key, value|sentinel) (missing key = unchanged, sentinel = removed)
	 *   array  -> auto-keyed map           (index diffs; pairs with array->map diffing)
	 *   scalar -> unchanged
	 *
	 * `sentinel` marks a removed value in your diff format (e.g. charm-sync's `None`).
	 * Requires a Lync build that exposes `nullable`.
	 
]]
local function partialDeep(codec, sentinel)
	local n = codec
	if n._schema ~= nil then
		local schema = {}
		for key, inner in n._schema do
			schema[key] = Lync.optional(partialDeep(inner, sentinel))
		end
		return Lync.struct(schema)
	end
	if n._isMap == true then
		return Lync.map(n._keyCodec, Lync.nullable(partialDeep(n._valueCodec, sentinel), sentinel))
	end
	if n._isArray == true then
		return Lync.map(Lync.auto, Lync.nullable(partialDeep(n._element, sentinel), sentinel))
	end
	return codec
end
return {
	partialDeep = partialDeep,
}

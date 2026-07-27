-- Compiled with rotor v2.2.1
local TS = _G[script]
local Lync = TS.import(script, TS.getModule(script, "@rbxts", "lync"))
-- Lync's private codec shape we introspect. If a Lync release renames these, this is the one spot.
--[[
	*
	 * The deep-partial diff shape `partialDeep` produces for a full-state type `T` with removal
	 * sentinel `S` — mirrors the codec transform:
	 *   array  -> Map<index, value | sentinel>   struct -> each field optional
	 *   map    -> Map<key,   value | sentinel>   scalar -> unchanged
	 
]]
local function build(codec, sentinel)
	local n = codec
	if n._schema ~= nil then
		local schema = {}
		for key, inner in n._schema do
			schema[key] = Lync.optional(build(inner, sentinel))
		end
		return Lync.struct(schema)
	end
	if n._isMap == true then
		return Lync.map(n._keyCodec, Lync.nullable(build(n._valueCodec, sentinel), sentinel))
	end
	if n._isArray == true then
		return Lync.map(Lync.auto, Lync.nullable(build(n._element, sentinel), sentinel))
	end
	return codec
end
--[[
	*
	 * Derive a deep-partial "diff" codec from a full-state codec:
	 *   struct -> each field optional      (absent = unchanged)
	 *   map    -> map(key, value|sentinel) (missing key = unchanged, sentinel = removed)
	 *   array  -> auto-keyed map           (index diffs; pairs with array->map diffing)
	 *   scalar -> unchanged
	 *
	 * `sentinel` marks a removed value in your diff format (e.g. charm-sync's `None`). The returned
	 * codec is typed `Codec<Diff<T, S>>`, so the input's shape carries through. Requires a Lync build
	 * that exposes `nullable`.
	 
]]
local function partialDeep(codec, sentinel)
	return build(codec, sentinel)
end
return {
	partialDeep = partialDeep,
}

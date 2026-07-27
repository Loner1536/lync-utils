--!strict
local Lync = require("@pkg/lync")

type Codec<T> = Lync.Codec<T>

--[[
	Derive a deep-partial "diff" codec from a full-state codec. Mirrors how structural
	diffs are shaped:
	  struct -> each field optional         (absent field = unchanged)
	  map    -> map(key,  value | sentinel)  (missing key = unchanged, sentinel = removed)
	  array  -> map(auto, value | sentinel)  (index-keyed; pairs with array->map diffing)
	  scalar -> unchanged

	`sentinel` is the value your diff format uses to mark a removal (e.g. charm-sync's None).
	Reads Lync's private codec fields (_schema/_isMap/_isArray/...) — the one spot to update
	if a Lync release renames them.
]]
local function partialDeep<S>(codec: Codec<any>, sentinel: S): Codec<any>
	local node = codec :: any

	if node._schema ~= nil then
		local schema: { [string]: Codec<any> } = {}
		for key, inner in node._schema do
			schema[key] = Lync.optional(partialDeep(inner, sentinel))
		end
		return Lync.struct(schema)
	end
	if node._isMap == true then
		return Lync.map(node._keyCodec, Lync.nullable(partialDeep(node._valueCodec, sentinel), sentinel))
	end
	if node._isArray == true then
		return Lync.map(Lync.auto, Lync.nullable(partialDeep(node._element, sentinel), sentinel))
	end

	return codec
end

return partialDeep

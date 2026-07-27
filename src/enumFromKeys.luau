--!strict
local Lync = require("@pkg/lync")

type Codec<T> = Lync.Codec<T>

-- Lync.enum built from a table's keys, sorted for a stable client/server ordering.
-- The everyday "enum from a definitions table" pattern in one call.
local function enumFromKeys(object: { [string]: any }): Codec<string>
	local keys: { string } = {}
	for key in object do
		table.insert(keys, key)
	end
	table.sort(keys)
	return Lync.enum(table.unpack(keys))
end

return enumFromKeys

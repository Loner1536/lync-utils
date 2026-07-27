-- Compiled with rotor v2.2.1
local TS = _G[script]
local Lync = TS.import(script, TS.getModule(script, "@rbxts", "lync"))
--* `Lync.enum` from a table's keys, sorted for a stable client/server ordering. 
local function enumFromKeys(object)
	local keys = {}
	for key in object do
		table.insert(keys, key)
	end
	table.sort(keys)
	return Lync.enum(unpack(keys))
end
return {
	enumFromKeys = enumFromKeys,
}

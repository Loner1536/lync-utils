--!strict
-- Minimal type stub of the charm-sync surface used here.

export type None = { __none: "__none" }

local CharmSync = {
	patch = {
		nilToNone = function<T>(_value: T?): None
			return (nil :: any)
		end,
	},
}

return CharmSync

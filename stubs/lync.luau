--!strict
-- Minimal type stub of the Lync public surface these utils depend on, so the package
-- typechecks standalone. The real Lync provides the implementations at runtime.
-- (Lync is mid-rewrite; regenerate this against the new API when it lands.)

export type Codec<T> = { _t: T }

local Lync = {}

Lync.string = (nil :: any) :: Codec<string>
Lync.auto = (nil :: any) :: Codec<any>

function Lync.struct(_schema: { [string]: Codec<any> }): Codec<any>
	return (nil :: any)
end
function Lync.map<K, V>(_key: Codec<K>, _value: Codec<V>): Codec<any>
	return (nil :: any)
end
function Lync.array<T>(_element: Codec<T>): Codec<any>
	return (nil :: any)
end
function Lync.optional<T>(_codec: Codec<T>): Codec<any>
	return (nil :: any)
end
function Lync.nullable<T, S>(_codec: Codec<T>, _sentinel: S): Codec<any>
	return (nil :: any)
end
function Lync.tagged(_field: string, _variants: { [string]: Codec<any> }): Codec<any>
	return (nil :: any)
end
function Lync.enum(...: string): Codec<string>
	return (nil :: any)
end

return Lync

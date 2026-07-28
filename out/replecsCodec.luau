-- Compiled with rotor v2.2.1
-- Mirrors Lync's internal ChannelState (src/Types.luau) -- not part of the
-- public Codec<T> type, but every codec's `write`/`read` runs against this
-- shape at runtime. Lync's own unit tests build one by hand the same way
-- (test/unit/codec/Base.spec.luau, InternalChannel.create()).
local INITIAL_BUF = 64
local function createChannel()
	return {
		buff = buffer.create(INITIAL_BUF),
		cursor = 0,
		size = INITIAL_BUF,
		refs = {},
		refCount = 0,
		lastId = -1,
		countPos = -1,
		itemCount = 0,
		singleMode = false,
		singlePos = 0,
		deltas = {},
		prevDump = nil,
		prevDumpLen = 0,
		currentPacket = nil,
	}
end
local function dump(ch)
	local out = buffer.create(ch.cursor)
	buffer.copy(out, 0, ch.buff, 0, ch.cursor)
	return out
end
--[[
	*
	 * Turn a Lync codec into a Replecs `SerdesTable`, so per-component wire
	 * packing reuses Lync's own bit-packed encoders instead of hand-writing
	 * buffer.write* calls for every component.
	 *
	 * Pass `{ refs: true }` for codecs that push Instance references (e.g.
	 * `Lync.inst`) -- those can't live inside the buffer, so they ride
	 * alongside it via Replecs' `includes_variants` channel instead. Plain
	 * value codecs (numbers, vectors, structs/arrays/maps of those) don't need
	 * the option.
	 *
	 * Delta codecs (`deltaInt`, `deltaVec3`, ...) are rejected: they keep
	 * per-connection state and can't round-trip through a stateless
	 * serialize/deserialize pair.
	 *
	 * Codecs with no fixed `_size` are rejected too: Lync only leaves `_size`
	 * unset for `array`/`map` (or a struct/tuple containing one), which means
	 * this value can grow/shrink one key at a time yet Replecs still resends
	 * the WHOLE buffer on any change -- a footgun for things like a per-player
	 * inventory map. Split that into its own entity/component per key so
	 * Replecs' normal per-component change detection does the diffing instead.
	 * Pass `{ unbounded: true }` to opt in anyway (e.g. a small settings map
	 * that changes as a whole).
	 
]]
local function replecsCodec(codec, opts)
	local internal = codec
	if internal._isDelta or internal._hasDelta then
		error("replecsCodec: delta codecs keep per-connection state and can't be used as a component serdes -- use a non-delta codec")
	end
	if internal._size == nil and not (opts and opts.unbounded) then
		error("replecsCodec: codec has no fixed size (contains an array/map somewhere) -- any change resends the whole value. " .. "Split growable keys into their own component/entity, or pass { unbounded: true } to opt in anyway.")
	end
	if opts and opts.refs then
		return {
			bytespan = internal._size,
			includes_variants = true,
			serialize = function(value)
				local ch = createChannel()
				internal.write(ch, value)
				return dump(ch), if ch.refCount > 0 then (ch.refs) else nil
			end,
			deserialize = function(buf, refs)
				local value = internal.read(buf, 0, refs)
				return value
			end,
		}
	end
	return {
		bytespan = internal._size,
		serialize = function(value)
			local ch = createChannel()
			internal.write(ch, value)
			if ch.refCount > 0 then
				error("replecsCodec: codec pushed refs; pass { refs: true } to replecsCodec(codec, opts)")
			end
			return dump(ch)
		end,
		deserialize = function(buf)
			local value = internal.read(buf, 0)
			return value
		end,
	}
end
return {
	replecsCodec = replecsCodec,
}

import Lync from "@rbxts/lync";

/** `Lync.enum` from a table's keys, sorted for a stable client/server ordering. */
export function enumFromKeys(object: Record<string, unknown>): Lync.Codec<string> {
    const keys = new Array<string>();
    for (const [key] of object as unknown as Map<string, unknown>) keys.push(key);
    keys.sort();
    return Lync.enum(...keys);
}

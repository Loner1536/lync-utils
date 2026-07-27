import Lync from "@rbxts/lync";

/**
 * `Lync.enum` from a table's keys, sorted for a stable client/server ordering. The key union
 * carries through: `enumFromKeys({ a: …, b: … })` is typed `Codec<"a" | "b">`.
 */
export function enumFromKeys<T extends object>(object: T): Lync.Codec<keyof T & string> {
    const keys = new Array<string>();
    for (const [key] of object as unknown as Map<string, unknown>) keys.push(key);
    keys.sort();
    return Lync.enum(...keys) as unknown as Lync.Codec<keyof T & string>;
}

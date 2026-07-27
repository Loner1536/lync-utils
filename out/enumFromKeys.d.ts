import Lync from "@rbxts/lync";
/**
 * `Lync.enum` from a table's keys, sorted for a stable client/server ordering. The key union
 * carries through: `enumFromKeys({ a: …, b: … })` is typed `Codec<"a" | "b">`.
 */
export declare function enumFromKeys<T extends object>(object: T): Lync.Codec<keyof T & string>;

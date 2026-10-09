/** Stable non-security IFC identifiers. Scope by a saved random project ID, never by private user data. */
export function stableIfcGuid(identity: string): string {
  // Four independently seeded 32-bit lanes, then an avalanche, encoded as an IFC compressed 128-bit ID.
  // This is identity mapping, not a signature, authorization token, or content-integrity hash.
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  let value = BigInt(0);
  for (const seed of seeds) {
    let h = seed;
    for (let i = 0; i < identity.length; i++) h = Math.imul(h ^ identity.charCodeAt(i), 0x01000193);
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    value = (value << BigInt(32)) | BigInt(h >>> 0);
  }
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let result = '';
  for (let i = 0; i < 22; i++) { result = alphabet[Number(value & BigInt(63))] + result; value >>= BigInt(6); }
  return result;
}

/** STEP strings cannot introduce new entities, including via quotes, backslashes or control characters. */
export function ifcString(value: string): string {
  return "'" + value.split('').map(c => {
    const n = c.charCodeAt(0);
    return n >= 32 && n <= 126 && c !== '\\' ? c.replaceAll("'", "''") : `\\X2\\${n.toString(16).padStart(4, '0').toUpperCase()}\\X0\\`;
  }).join('') + "'";
}

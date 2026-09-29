/**
 * Deterministic, dynamic color generator for collaborative editing.
 * Generates distinct, high-contrast, accessible colors from any user ID, name, or email.
 * Does not use static name matching.
 */
const COLLABORATIVE_PALETTE = [
  '#2563eb', // Royal Blue
  '#dc2626', // Crimson Red
  '#9333ea', // Vivid Purple
  '#059669', // Emerald Green
  '#ea580c', // Bright Orange
  '#0891b2', // Cyan / Teal
  '#db2777', // Rose Pink
  '#4f46e5', // Indigo
  '#d97706', // Warm Amber
  '#7c3aed', // Deep Violet
  '#0d9488', // Deep Teal
  '#ca8a04', // Golden Olive
] as const;

export function getUserColor(identifier?: string | null): string {
  if (!identifier || typeof identifier !== 'string') {
    return COLLABORATIVE_PALETTE[0];
  }

  const str = identifier.trim();
  if (!str) {
    return COLLABORATIVE_PALETTE[0];
  }

  // FNV-1a 32-bit hash algorithm for even, uniform distribution
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const index = Math.abs(hash >>> 0) % COLLABORATIVE_PALETTE.length;
  return COLLABORATIVE_PALETTE[index];
}

export function toJsonSafe<T>(value: T): T {
  return normalize(value) as T;
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, normalize(entry)]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

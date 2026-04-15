export const BLOCKLIST = [
  // TODO: populate before launch. Examples format:
  // /\bslur\b/i,
  // "prohibited phrase",
];

export function isBlocked(text) {
  const lower = text.toLowerCase();
  return BLOCKLIST.some((pattern) =>
    pattern instanceof RegExp ? pattern.test(text) : lower.includes(pattern)
  );
}

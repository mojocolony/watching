// Present legacy and current subscription labels consistently.
const aliases = new Map([
  ['apple tv+', 'Apple TV'],
  ['apple tv plus', 'Apple TV'],
  ['apple tv', 'Apple TV'],
  ['disney plus', 'Disney+'],
  ['paramount plus', 'Paramount+'],
]);

export function displayProviderName(name) {
  const original = String(name ?? '').trim();
  return aliases.get(original.toLocaleLowerCase('en-CA')) ?? original;
}

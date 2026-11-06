/** Preserve existing VP Lab links before Vue's default route takes over. */
export function normalizeLegacyTab(input: URL, tabs: readonly string[]): URL {
  const url = new URL(input.href);
  const tab = url.searchParams.get('tab');
  if (!tab || !tabs.includes(tab)) return url;

  // An explicit hash route wins; removing the old tab also keeps login from
  // replacing that route with a conflicting legacy query parameter.
  url.searchParams.delete('tab');
  if (!url.hash || url.hash === '#/') url.hash = `/${tab}`;
  return url;
}

import type { SiteItem } from "./db";

export function filterItemsByKeywords(
  items: SiteItem[],
  keywords: string[]
): SiteItem[] {
  if (keywords.length === 0) return items;
  const lowered = keywords.map((k) => k.toLowerCase());

  return items.filter((item) => {
    const haystack = `${item.title} ${item.url}`.toLowerCase();
    return lowered.some((keyword) => haystack.includes(keyword));
  });
}

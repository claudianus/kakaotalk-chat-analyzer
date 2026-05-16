const HASHTAG_RE = /#([가-힣A-Za-z][가-힣A-Za-z0-9_]{1,22})/g;

export interface HashtagKeywordOptions {
  senderNames: ReadonlySet<string>;
  exclude?: ReadonlySet<string>;
}

/** 키워드 보조: 메시지당 해시태그 1회 */
export function extractHashtagKeywords(message: string, options: HashtagKeywordOptions): string[] {
  const bag = new Set<string>();
  for (const m of message.matchAll(HASHTAG_RE)) {
    const tag = m[1]!.trim();
    if (tag.length < 2 || tag.length > 24) continue;
    if (options.exclude?.has(tag)) continue;
    if (options.senderNames.has(tag)) continue;
    bag.add(tag);
  }
  return [...bag];
}

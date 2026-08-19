import { articles, type Article } from "@/data/articles";

/**
 * Picks the journal entries closest to the one being read.
 *
 * Shared keywords weigh most: two texts that name the same subject are related
 * whatever section they sit in. Sharing a direction is a weaker signal, and a
 * shared series weaker still — it groups instalments that already follow each
 * other. Ties go to the newer material, so a reader who lands on an old page is
 * not sent further into the archive.
 */
export function relatedArticles(current: Article, limit = 3): Article[] {
  const currentKeywords = new Set(current.keywords.map((keyword) => keyword.toLowerCase()));

  return articles
    .filter((article) => article.slug !== current.slug)
    .map((article) => {
      const sharedKeywords = article.keywords.filter((keyword) =>
        currentKeywords.has(keyword.toLowerCase()),
      ).length;

      return {
        article,
        score:
          sharedKeywords * 4 +
          (article.direction === current.direction ? 2 : 0) +
          (current.series && article.series === current.series ? 1 : 0),
      };
    })
    .sort((first, second) =>
      second.score - first.score ||
      second.article.publishedAt.localeCompare(first.article.publishedAt),
    )
    .slice(0, limit)
    .map((entry) => entry.article);
}

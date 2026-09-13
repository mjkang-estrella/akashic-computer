import { docArticleBySlug } from "@/lib/atlas/docsArticles";
import { DocsArticleView, LexiconArticleView } from "./DocsArticleView";

import { StudyHub } from "./StudyHub";

export function LearnView({
  slug,
  onOpen,
  onBack,
}: {
  slug: string | null;
  onOpen: (slug: string) => void;
  onBack: () => void;
}) {
  if (slug === "lexicon") {
    return <LexiconArticleView onBack={onBack} />;
  }

  const article = docArticleBySlug(slug);
  if (article) {
    return <DocsArticleView article={article} onOpen={onOpen} onBack={onBack} />;
  }

  return <StudyHub />;
}

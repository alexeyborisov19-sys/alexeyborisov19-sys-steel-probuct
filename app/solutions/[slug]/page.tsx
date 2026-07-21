import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SolutionDetailPage } from "@/components/SolutionDetailPage";
import { solutionDetailBySlug, solutionDetails } from "@/data/solution-details";
import { solutionSearchPhrases } from "@/data/semantic";
import { createPageMetadata } from "@/lib/seo";

type SolutionPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return solutionDetails.map((solution) => ({ slug: solution.slug }));
}

export async function generateMetadata({ params }: SolutionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const solution = solutionDetailBySlug[slug];
  if (!solution) return {};
  return createPageMetadata({
    title: solution.title,
    description: solution.description,
    path: `/solutions/${solution.slug}`,
    image: solution.image,
    keywords: solutionSearchPhrases(solution.slug),
  });
}

export default async function SolutionPage({ params }: SolutionPageProps) {
  const { slug } = await params;
  const solution = solutionDetailBySlug[slug];
  if (!solution) notFound();
  return <SolutionDetailPage solution={solution} />;
}

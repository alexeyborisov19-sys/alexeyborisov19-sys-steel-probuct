import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SolutionDetailPage } from "@/components/SolutionDetailPage";
import { solutionDetailBySlug, solutionDetails } from "@/data/solution-details";
import { solutionSeoBySlug } from "@/data/solution-seo";
import { createPageMetadata } from "@/lib/seo";

type SolutionPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return solutionDetails.map((solution) => ({ slug: solution.slug }));
}

export async function generateMetadata({ params }: SolutionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const solution = solutionDetailBySlug[slug];
  if (!solution) return {};
  const seo = solutionSeoBySlug[slug];
  return createPageMetadata({
    title: seo?.seoTitle ?? solution.title,
    description: seo?.metaDescription ?? solution.description,
    path: `/solutions/${solution.slug}`,
    image: solution.image,
    keywords: seo?.keywords,
  });
}

export default async function SolutionPage({ params }: SolutionPageProps) {
  const { slug } = await params;
  const solution = solutionDetailBySlug[slug];
  if (!solution) notFound();
  return <SolutionDetailPage solution={solution} />;
}

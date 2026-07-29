import { PageLayout } from "./PageLayout";

type LegalDocumentProps = {
  title: string;
  description: string;
  path: string;
  children: React.ReactNode;
};

export function LegalDocument({ title, description, path, children }: LegalDocumentProps) {
  return <PageLayout path={path} eyebrow="Правовая информация" title={title} description={description}>
    <section className="bg-[#101112] py-14 sm:py-20">
      <article className="container max-w-4xl">
        <div className="border border-white/15 bg-[#151719] p-6 sm:p-10">
          <div className="legal-document text-sm leading-relaxed text-white/68 sm:text-[15px]">{children}</div>
        </div>
      </article>
    </section>
  </PageLayout>;
}

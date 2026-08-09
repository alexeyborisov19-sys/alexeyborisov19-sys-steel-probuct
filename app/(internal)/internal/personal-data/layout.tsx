import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Закрытая система управления персональными данными",
  description: "Внутренняя защищённая система",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  referrer: "no-referrer",
};

export default function PersonalDataLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import { PrivateCalculationBasisImportForm } from "@/components/PrivateCalculationBasisImportForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private calculation setup",
  robots: { index: false, follow: false, noarchive: true },
};

export default function PrivateCalculationBasisPage() {
  return (
    <main className="min-h-screen bg-[#090c0e] px-4 py-12">
      <PrivateCalculationBasisImportForm />
    </main>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { trackLeadEvent } from "@/lib/analytics";
import {
  buildProductCalculatorAssistantDraft,
  buildPublicCalculatorAssistantDraft,
  type CalculatorHelpKind,
  type PublicCalculatorDraftInput,
} from "@/lib/assistant/calculator-draft";

const EngineeringAssistant = dynamic(
  () => import("@/components/EngineeringAssistant").then((module) => module.EngineeringAssistant),
  { ssr: false },
);

type HelpProps = (
  | ({ calculator?: "cad" } & PublicCalculatorDraftInput)
  | { calculator: CalculatorHelpKind }
) & { appearance?: "dark" | "light" };

/**
 * Inline entry for public calculators only. Opens a reviewable text draft:
 * no files, customer details, CAD bytes, or prices are automatically sent.
 */
export function CalculatorEngineeringHelp(props: HelpProps) {
  const openerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
  }, []);

  function openAssistant() {
    const text = props.calculator && props.calculator !== "cad"
      ? buildProductCalculatorAssistantDraft(props.calculator)
      : buildPublicCalculatorAssistantDraft(props);
    setDraft(text.slice(0, 1400));
    setOpen(true);
    trackLeadEvent("assistant_opened", {
      assistant: "engineering",
      page_context: props.calculator ?? "dxf-online-order",
    });
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={openAssistant}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Открыть инженерного помощника с вопросом, который можно исправить перед отправкой"
        className={`inline-flex min-h-12 items-center rounded-lg border px-4 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel-orange ${
          props.appearance === "light"
            ? "border-orange-700/50 bg-white text-orange-900 hover:bg-orange-50"
            : "border-steel-orange/60 text-orange-300 hover:bg-steel-orange/10"
        }`}
      >
        Спросить ИИ-инженера
      </button>
      {open && (
        <EngineeringAssistant
          initialOpen
          hideLauncher
          initialDraft={draft}
          onClose={close}
        />
      )}
    </>
  );
}

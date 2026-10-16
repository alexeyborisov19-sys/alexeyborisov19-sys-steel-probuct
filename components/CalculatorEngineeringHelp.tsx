"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { trackLeadEvent } from "@/lib/analytics";
import {
  buildPublicCalculatorAssistantDraft,
  type PublicCalculatorDraftInput,
} from "@/lib/assistant/calculator-draft";

// Load the existing engineering assistant only after an explicit user click.
// No additional third-party chat runtime and no automatic model request.
const EngineeringAssistant = dynamic(
  () => import("@/components/EngineeringAssistant").then((module) => module.EngineeringAssistant),
  { ssr: false },
);

export function CalculatorEngineeringHelp(props: PublicCalculatorDraftInput) {
  const openerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
  }, []);

  function openAssistant() {
    // This collects only visible, non-confidential inputs, with no CAD payload,
    // filename, calculated price or contact details. The text remains editable.
    setDraft(buildPublicCalculatorAssistantDraft(props));
    setOpen(true);
    trackLeadEvent("assistant_opened", { assistant: "engineering", page_context: "dxf-online-order" });
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={openAssistant}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Подготовить вопрос по выбранным параметрам. Ничего не отправляется автоматически."
        className="inline-flex min-h-12 items-center rounded-lg border border-steel-orange/60 px-4 py-3 text-sm font-semibold text-steel-orange transition hover:bg-steel-orange/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel-orange"
      >
        Помощь ИИ-инженера
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

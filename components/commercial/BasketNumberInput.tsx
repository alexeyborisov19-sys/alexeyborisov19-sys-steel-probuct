"use client";

import { useEffect, useState } from "react";

/** Keep the typed text intact: deleting a value or typing a decimal must not reset the caret. */
export function BasketNumberInput({
  value,
  onValue,
  emptyValue = NaN,
  min = 0,
  max,
  ...props
}: {
  value: number | null;
  onValue: (value: number | null) => void;
  emptyValue?: number | null;
  min?: number;
  max: number;
  className?: string;
  placeholder?: string;
}) {
  const display = (v: number | null) =>
    v === null || !Number.isFinite(v) ? "" : String(v);
  const [text, setText] = useState(display(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(display(value));
  }, [value, focused]);
  const invalid =
    text !== "" &&
    (!Number.isFinite(value) || value === null || value < min || value > max);
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      aria-invalid={invalid || undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const normalized = raw.trim().replace(",", ".");
        onValue(
          normalized === ""
            ? emptyValue
            : /^\d+(?:\.\d*)?$/.test(normalized)
              ? Number(normalized)
              : NaN,
        );
      }}
    />
  );
}

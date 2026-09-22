import { occtStepKernel } from "../../instant-quote/occt-step-kernel";

// This entry is bundled separately and runs only in an expendable Node child.
process.once("message", async (message: { bytes?: Uint8Array }) => {
  try {
    if (!(message.bytes instanceof Uint8Array) || !message.bytes.byteLength || message.bytes.byteLength > 100 * 1024 * 1024) throw new Error("Invalid STEP input");
    const value = await occtStepKernel.readStepWithPrivateEvidence(message.bytes);
    process.send?.({ ok: true, value }, error => process.exit(error ? 1 : 0));
  } catch {
    process.send?.({ ok: false }, () => process.exit(1));
  }
});
process.once("disconnect", () => process.exit(1));

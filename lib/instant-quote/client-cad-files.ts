import { normalizeCadFormat } from "@/lib/instant-quote/domain";

/** Validate the whole project before sending files to preview or calculation. */
export function selectCadFiles<T extends { name: string; size: number }>(
  incoming: T[],
  existing: ReadonlyArray<{ fileSizeBytes: number }>,
  maximumParts = 10,
) {
  const accepted: T[] = [];
  const errors: string[] = [];
  let bytes = existing.reduce((sum, part) => sum + part.fileSizeBytes, 0);
  for (const file of incoming) {
    let reason: string | null = null;
    if (!normalizeCadFormat(file.name)) reason = "поддерживаются DXF, STEP, STP и DWG";
    else if (!Number.isFinite(file.size) || file.size <= 0) reason = "файл пустой";
    else if (file.size > 7 * 1024 * 1024) reason = "размер файла превышает 7 МБ";
    else if (existing.length + accepted.length >= maximumParts) reason = `в проекте может быть не более ${maximumParts} позиций`;
    else if (bytes + file.size > 10 * 1024 * 1024) reason = "общий размер файлов проекта превышает 10 МБ";
    if (reason) {
      errors.push(`${file.name}: ${reason}.`);
      continue;
    }
    accepted.push(file);
    bytes += file.size;
  }
  return { accepted, errors };
}

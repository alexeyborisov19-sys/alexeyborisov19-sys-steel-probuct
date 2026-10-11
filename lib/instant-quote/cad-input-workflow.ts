import type { InstantQuoteProject, PartConfiguration } from './domain';
import { nearestThicknessOption } from './client-labels';

// Match existing server transport limits without importing server-only code.
export const CAD_INPUT_LIMITS = { maximumFileBytes: 50 * 1024 * 1024, maximumTotalBytes: 100 * 1024 * 1024 } as const;
export function validateCadUploadBudget(files: readonly Pick<File, 'name' | 'size'>[], existingBytes: number): void {
  for (const file of files) {
    if (file.size > CAD_INPUT_LIMITS.maximumFileBytes) throw new Error(`Файл «${file.name}» не добавлен: допустимо до 50 МБ на файл.`);
  }
  if (existingBytes + files.reduce((sum, file) => sum + file.size, 0) > CAD_INPUT_LIMITS.maximumTotalBytes) {
    throw new Error('Файлы не добавлены: общий размер проекта не должен превышать 100 МБ. Удалите ненужную позицию или создайте отдельный проект.');
  }
}
export function parseCadQuantityDraft(draft: string): { value: number; error: null } | { value: null; error: string } {
  const value = Number(draft);
  if (!/^\d+$/.test(draft) || !Number.isSafeInteger(value) || value < 1 || value > 100_000) {
    return { value: null, error: 'Укажите целое количество от 1 до 100 000 без дробей.' };
  }
  return { value, error: null };
}
export type CadEditedField = 'thickness' | 'bending' | 'countersink';
export function applyCadDetectedConfiguration(
  project: InstantQuoteProject,
  partId: string,
  detected: { thicknessFromModelMm: number | null; bendCountFromModel: number | null; countersinkCountFromModel?: number | null },
  editedFields: ReadonlySet<CadEditedField> = new Set(),
): InstantQuoteProject {
  return { ...project, parts: project.parts.map(part => {
    if (part.id !== partId) return part;
    const configuration: PartConfiguration = { ...part.configuration, operations: [...part.configuration.operations], operationInputs: { ...part.configuration.operationInputs } };
    const thickness = nearestThicknessOption(detected.thicknessFromModelMm);
    if (!editedFields.has('thickness') && thickness != null) configuration.thicknessMm = thickness;
    if (!editedFields.has('bending') && detected.bendCountFromModel != null && detected.bendCountFromModel > 0) {
      if (!configuration.operations.includes('bending')) configuration.operations.push('bending');
      configuration.operationInputs!.bendCount = detected.bendCountFromModel;
    }
    if (!editedFields.has('countersink') && detected.countersinkCountFromModel != null && detected.countersinkCountFromModel > 0) {
      if (!configuration.operations.includes('countersink')) configuration.operations.push('countersink');
      configuration.operationInputs!.countersinkCount = Math.max(detected.countersinkCountFromModel, configuration.operationInputs?.countersinkCount ?? 0);
    }
    return { ...part, configuration };
  }) };
}

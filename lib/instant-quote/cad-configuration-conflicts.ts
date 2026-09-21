/** A client edit cannot cancel a bend proven by server CAD analysis. */
export function bendConfigurationConflict(measured: number | null | undefined, operations: readonly string[], declared?: number): string | null {
  if (measured == null || !Number.isFinite(measured) || measured <= 0) return null;
  if (!operations.includes('bending')) return `По модели определено гибов: ${measured}. Добавьте гибку или передайте деталь технологу.`;
  if (declared != null && declared !== measured) return `По модели определено гибов: ${measured}, указано вами: ${declared}. Противоречие требует проверки технологом.`;
  return null;
}

"use client";

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { InstantQuoteProject } from '@/lib/instant-quote/domain';
import { createCadProjectFile, MAX_PROJECT_FILE_BYTES, parseCadProjectFile, type CadAttachmentManifest, type CadProjectFile, type CadProjectSource } from '@/lib/instant-quote/project-file';

const button = 'min-h-11 rounded-lg border border-white/25 px-4 py-2 text-sm hover:border-steel-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel-orange disabled:cursor-not-allowed disabled:opacity-40';

type Props = {
  project: InstantQuoteProject;
  filesByPartId: Record<string, File>;
  sourcesByPartId: Record<string, CadProjectSource>;
  revision: number;
  disabled: boolean;
  hasManualDraft: boolean;
  missingAttachments: { partId: string; attachment: CadAttachmentManifest }[];
  onRename: (title: string) => void;
  onRestore: (saved: CadProjectFile) => Promise<void>;
  onReattach: (partId: string, file: File) => Promise<void>;
};

export function ProjectFileControls({ project, filesByPartId, sourcesByPartId, revision, disabled, hasManualDraft, missingAttachments, onRename, onRestore, onReattach }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<CadProjectFile | null>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const locked = disabled || busy;
  useEffect(() => { if (pending) confirmButton.current?.focus(); }, [pending]);
  const reportError = (error: unknown) => { setFailed(true); setMessage(error instanceof Error ? error.message : 'Не удалось прочитать файл проекта.'); };

  async function download() {
    setBusy(true); setFailed(false); setMessage('Готовим файл проекта и контрольные суммы CAD…');
    try {
      const saved = await createCadProjectFile(project, filesByPartId, sourcesByPartId, revision);
      const url = URL.createObjectURL(new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `steel-product-project-r${saved.revision}.json`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Скачан проект на момент нажатия: ${saved.positions.length} поз., ревизия ${saved.revision}. Храните исходные CAD рядом с JSON.${hasManualDraft ? ' Незавершённый ввод размеров не включён: сначала добавьте изделие в расчёт.' : ''}`);
    } catch (error) { reportError(error); } finally { setBusy(false); }
  }

  async function read(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || locked) return;
    setBusy(true); setPending(null); setFailed(false); setMessage('');
    try {
      if (file.size > MAX_PROJECT_FILE_BYTES) throw new Error('Файл проекта превышает лимит 64 КБ. Выберите сохранённый JSON, а не исходный CAD.');
      setPending(parseCadProjectFile(await file.text()));
    } catch (error) { reportError(error); } finally { setBusy(false); }
  }

  async function restore() {
    if (!pending || locked) return;
    setBusy(true); setFailed(false); setMessage('');
    try {
      await onRestore(pending);
      setPending(null);
      setMessage('Проект открыт. Старая стоимость не переносится. Проверьте восстановленные параметры перед новым расчётом.');
    } catch (error) { reportError(error); } finally { setBusy(false); }
  }

  async function reattach(event: ChangeEvent<HTMLInputElement>, partId: string) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || locked) return;
    setBusy(true); setFailed(false); setMessage('Сверяем содержимое исходного CAD…');
    try { await onReattach(partId, file); setMessage('Исходный CAD прикреплён; результат повторного анализа указан у позиции.'); }
    catch (error) { reportError(error); } finally { setBusy(false); }
  }

  return <section className="mb-5 rounded-xl border border-white/15 bg-[#141b21] p-4" aria-label="Файл проекта">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-semibold">Сохранить и продолжить позже</h2><p className="mt-1 text-xs leading-5 text-white/70">JSON хранит параметры и список исходников. CAD и старые цены в него не входят. Автосохранения нет.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={locked || !project.parts.length} onClick={() => void download()}>Скачать проект</button><button type="button" ref={openButton} className={button} disabled={locked} onClick={() => input.current?.click()}>Открыть JSON проекта</button></div>
    </div>
    {project.parts.length > 0 && <div className="mt-3 flex flex-wrap items-end gap-3"><label className="block min-w-0 flex-1 text-xs text-white/70" htmlFor="cad-project-title">Название проекта<input id="cad-project-title" value={project.title} maxLength={120} onChange={event => onRename(event.target.value)} disabled={locked} className="mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-[#101820] px-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-steel-orange disabled:opacity-50" /></label><p className="pb-3 text-xs text-white/65">Ревизия {revision}</p></div>}
    {pending && <div className="mt-4 rounded-lg border border-amber-300/40 p-3">
      <p className="break-words text-sm">Открыть «{pending.title}»? {pending.positions.length} поз., ревизия {pending.revision}. Исходных CAD для повторного прикрепления: {pending.positions.filter(position => position.source.kind === 'cad').length}.</p>
      {(project.parts.length > 0 || hasManualDraft) && <p className="mt-2 text-sm leading-6 text-amber-200">Текущие позиции ({project.parts.length}) и незавершённый ввод будут заменены. Сначала скачайте текущий проект, если он ещё нужен.</p>}
      <div className="mt-3 flex flex-wrap gap-2"><button ref={confirmButton} type="button" disabled={locked} onClick={() => void restore()} className={`${button} border-steel-orange text-steel-orange`}>{project.parts.length > 0 || hasManualDraft ? 'Заменить текущий проект' : 'Открыть этот проект'}</button><button type="button" disabled={locked} onClick={() => { setPending(null); openButton.current?.focus(); }} className={button}>Отмена</button></div>
    </div>}
    {missingAttachments.length > 0 && <div className="mt-4 border-t border-white/15 pt-3">
      <p role="status" className="text-sm font-medium text-amber-200">Не прикреплены исходные CAD: {missingAttachments.length}. До их загрузки расчёт проекта недоступен.</p>
      <p className="mt-1 text-xs leading-5 text-white/70">Выберите оригинал для каждой позиции. Проверяем SHA-256 содержимого, затем заново анализируем CAD. Совпадение имени и размера недостаточно.</p>
      <ul className="mt-3 space-y-3">{missingAttachments.map(({ partId, attachment }) => <li key={partId} className="min-w-0 rounded-lg border border-white/15 p-3">
        <p className="break-all text-sm">Позиция {project.parts.findIndex(part => part.id === partId) + 1}: {attachment.fileName}</p><p className="mt-1 text-xs text-white/65">{attachment.sizeBytes.toLocaleString('ru-RU')} байт</p>
        <label className="mt-2 block text-xs text-white/75">Прикрепить оригинал для этой позиции<input type="file" accept=".dxf,.dwg,.step,.stp" disabled={locked} aria-label={`Исходный CAD позиции ${project.parts.findIndex(part => part.id === partId) + 1}: ${attachment.fileName}`} onChange={event => void reattach(event, partId)} className="mt-1 block min-h-11 w-full min-w-0 max-w-full text-sm file:mr-2 file:min-h-11 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:text-white disabled:opacity-40" /></label>
      </li>)}</ul>
    </div>}
    {message && <p role={failed ? 'alert' : 'status'} className={`mt-3 text-sm leading-6 ${failed ? 'text-amber-200' : 'text-white/75'}`}>{message}</p>}
    <input ref={input} type="file" accept=".json,application/json" disabled={locked} onChange={event => void read(event)} className="hidden" aria-label="Импорт JSON проекта" />
  </section>;
}

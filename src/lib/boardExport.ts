import type { Editor } from 'tldraw';

/**
 * Экспорт доски.
 *
 * PNG — прямой рендер выделения/страницы через `editor.toImage` (нативный API tldraw).
 * PDF — тот же рендер, вставленный в печатное окно: браузер сохраняет его как PDF
 * («Сохранить как PDF» в диалоге печати). Отдельная PDF-библиотека не нужна.
 */

const safeFileName = (name: string): string =>
  name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'board';

export async function renderBoardImage(
  editor: Editor,
  options?: { selectionOnly?: boolean; scale?: number }
): Promise<{ blob: Blob; width: number; height: number }> {
  const selected = editor.getSelectedShapeIds();
  const shapes =
    options?.selectionOnly && selected.length > 0 ? selected : editor.getCurrentPageShapes();
  if (shapes.length === 0) {
    throw new Error('На доске пока нет объектов для экспорта');
  }
  return editor.toImage(shapes, {
    format: 'png',
    background: true,
    scale: options?.scale ?? 2,
  });
}

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

export async function exportBoardPng(
  editor: Editor,
  boardName: string,
  options?: { selectionOnly?: boolean }
): Promise<void> {
  const { blob } = await renderBoardImage(editor, options);
  downloadBlob(blob, `${safeFileName(boardName)}.png`);
}

export async function exportBoardPdf(editor: Editor, boardName: string): Promise<void> {
  const { blob } = await renderBoardImage(editor, { scale: 2 });
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Не удалось подготовить PDF'));
    reader.readAsDataURL(blob);
  });

  const printWindow = window.open('', '_blank', 'width=1200,height=900');
  if (!printWindow) {
    throw new Error('Браузер заблокировал окно печати — разрешите всплывающие окна');
  }
  printWindow.document.write(`<!doctype html><html><head><title>${safeFileName(boardName)}</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      html, body { margin: 0; padding: 0; background: #06070c; }
      img { width: 100%; height: auto; display: block; }
    </style></head><body><img src="${dataUrl}" alt="board" /></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 400);
}

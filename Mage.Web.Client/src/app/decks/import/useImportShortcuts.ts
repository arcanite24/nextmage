import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { recognize } from '../../../core/deckImport/recognize';
import { openImport, useImportSheet, type ImportTarget } from '../../stores/importSheet';
import { notify } from '../../stores/toasts';
import { isEditableEventTarget } from '../../ui/keys';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * ⌘V / Ctrl+V anywhere on the screen (outside a text field or a dialog) with a deck link or list on the
 * clipboard opens the import sheet with it. Uses the paste event, so the browser never asks for clipboard access.
 */
export function useImportPaste(target: ImportTarget = { kind: 'new' }) {
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  });
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (isEditableEventTarget(event.target) || useImportSheet.getState().open || document.querySelector('[role="dialog"]')) return;
      const text = event.clipboardData?.getData('text/plain') ?? '';
      if (recognize(text).kind === 'empty') return;
      event.preventDefault();
      openImport({ kind: 'text', text }, targetRef.current);
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);
}

/** Reads whatever was dropped (a deck file, a link dragged from another tab, selected text) and opens the sheet. */
export async function importDropped(data: DataTransfer, target: ImportTarget = { kind: 'new' }): Promise<boolean> {
  const file = data.files?.[0];
  if (file) {
    if (file.size > MAX_FILE_BYTES) {
      notify(`${file.name} is too large`, 'Deck files are a few kilobytes; this one is more than 2 MB.', 'error');
      return false;
    }
    openImport({ kind: 'file', name: file.name, text: await file.text() }, target);
    return true;
  }
  const link = data.getData('text/uri-list').split(/\r?\n/).find((line) => line && !line.startsWith('#'));
  const text = link || data.getData('text/plain');
  if (recognize(text).kind === 'empty') return false;
  openImport({ kind: 'text', text }, target);
  return true;
}

function carriesImport(event: DragEvent): boolean {
  const types = Array.from(event.dataTransfer?.types ?? []);
  return types.includes('Files') || types.includes('text/uri-list') || types.includes('text/plain');
}

/** Drop-target props for a shelf: highlights while something importable is dragged over it. */
export function useImportDrop(target: ImportTarget = { kind: 'new' }) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const onDragEnter = useCallback((event: DragEvent) => {
    if (!carriesImport(event)) return;
    event.preventDefault();
    depth.current += 1;
    setDragging(true);
  }, []);
  const onDragOver = useCallback((event: DragEvent) => {
    if (!carriesImport(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);
  const onDragLeave = useCallback(() => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  }, []);
  const onDrop = useCallback((event: DragEvent) => {
    if (!carriesImport(event)) return;
    event.preventDefault();
    depth.current = 0;
    setDragging(false);
    void importDropped(event.dataTransfer, target);
  }, [target]);

  return { dragging, dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}

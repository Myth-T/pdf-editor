'use client';

import { useEffect, useState } from 'react';
import { useEditorStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Eraser, PenLine, Trash2 } from 'lucide-react';

interface SelectedTextInfo {
  text: string;
  left: number;   // viewport px
  top: number;    // viewport px
  width: number;  // viewport px
  height: number; // viewport px
}

/**
 * Detects a selection inside react-pdf's native text layer and offers actions:
 * - 删除（橡皮）：cover the original text with a white rectangle (whiteout)
 * - 改为可编辑：convert the selected text into an editable layer element that can
 *   be moved / resized / recolored / deleted like any other annotation
 */
export function TextEditToolbar() {
  const { currentPage, scale, addLayer, selectElement } = useEditorStore();
  const [sel, setSel] = useState<SelectedTextInfo | null>(null);

  useEffect(() => {
    const update = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setSel(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const common = range.commonAncestorContainer;
      const node = (common.nodeType === Node.TEXT_NODE ? common.parentElement : common) as HTMLElement | null;
      const layer = node?.closest?.('.textLayer');
      if (!layer) {
        setSel(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSel(null);
        return;
      }

      setSel({
        text: selection.toString(),
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    document.addEventListener('selectionchange', update);
    document.addEventListener('mouseup', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('mouseup', update);
    };
  }, []);

  if (!sel || sel.text.trim() === '') return null;

  // Convert viewport coords to PDF point coords relative to the page element.
  const toPdfCoords = () => {
    const pageEl = document.querySelector('#pdf-page-container .react-pdf__Page');
    if (!pageEl) return null;
    const pr = pageEl.getBoundingClientRect();
    // The rendered page width in px; textLayer coordinates are in the same space.
    const renderScale = pr.width / (pageEl.getAttribute('data-main-rotation') ? 1 : 1);
    void renderScale;
    return {
      // x,y = PDF points (divide viewport offset by page css width * page scale)
      x: (sel.left - pr.left) / scale,
      y: (sel.top - pr.top) / scale,
      width: sel.width / scale,
      height: sel.height / scale,
    };
  };

  const handleWhiteout = () => {
    const c = toPdfCoords();
    if (!c) return;
    // Cover original text with an opaque white rect (plus small padding).
    const pad = 1.5;
    const id = crypto.randomUUID();
    addLayer(currentPage, {
      id,
      type: 'rect',
      x: c.x - pad,
      y: c.y - pad,
      width: c.width + pad * 2,
      height: c.height + pad * 2,
      rotation: 0,
      style: { backgroundColor: '#ffffff', opacity: 1 },
    });
    selectElement(id);
    window.getSelection()?.removeAllRanges();
    setSel(null);
  };

  const handleMakeEditable = () => {
    const c = toPdfCoords();
    if (!c) return;
    const id = crypto.randomUUID();
    // Whiteout the original first, then add editable text on top.
    const pad = 1.5;
    addLayer(currentPage, {
      id: crypto.randomUUID(),
      type: 'rect',
      x: c.x - pad,
      y: c.y - pad,
      width: c.width + pad * 2,
      height: c.height + pad * 2,
      rotation: 0,
      style: { backgroundColor: '#ffffff', opacity: 1 },
    });
    addLayer(currentPage, {
      id,
      type: 'text',
      x: c.x,
      y: c.y,
      width: Math.max(c.width, 40),
      height: Math.max(c.height, 24),
      rotation: 0,
      content: sel.text,
      style: { fontSize: Math.max(8, c.height * 0.8), color: '#000000' },
    });
    selectElement(id);
    window.getSelection()?.removeAllRanges();
    setSel(null);
  };

  const toolbarLeft = Math.max(8, Math.min(sel.left + sel.width / 2 - 90, window.innerWidth - 200));

  return (
    <div
      className="fixed z-[9999] flex items-center gap-1 bg-background border shadow-lg rounded-none px-1.5 py-1 animate-in fade-in duration-150"
      style={{ left: toolbarLeft, top: Math.max(4, sel.top - 44) }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={handleWhiteout}
        title="用白色覆盖原文（删除）"
      >
        <Eraser className="h-3.5 w-3.5 mr-1" />
        删除
      </Button>
      <div className="h-5 w-px bg-border" />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={handleMakeEditable}
        title="转为可编辑文字（可移动/改样式）"
      >
        <PenLine className="h-3.5 w-3.5 mr-1" />
        改为可编辑
      </Button>
      <div className="h-5 w-px bg-border" />
      <span className="text-[10px] text-muted-foreground px-1 max-w-[120px] truncate">
        {sel.text}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => { window.getSelection()?.removeAllRanges(); setSel(null); }}
        title="取消选择"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

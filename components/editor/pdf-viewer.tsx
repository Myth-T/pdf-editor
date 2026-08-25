'use client';

import { useEditorStore } from '@/lib/store';
import { useCallback, useEffect, useState } from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import '@/lib/pdf-setup'; // Ensure worker is set
import { CanvasLayer } from './canvas-layer';
import { TextEditToolbar } from './text-edit-toolbar';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export function PDFViewer() {
  const { pdfFile, currentPage, scale, setNumPages, setPageDimensions, pageDimensions, pageRotations, activeTool } = useEditorStore();
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, [setNumPages]);

  // Resize observer to track container width (for responsive mobile rendering)
  useEffect(() => {
    if (!containerRef) return;
    const update = () => setContainerWidth(Math.max(0, Math.floor(containerRef.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef);
    return () => ro.disconnect();
  }, [containerRef]);

  // Make clicking (or double-clicking) the native PDF text select that text.
  // The default single-click behavior only places a caret, which reads as "can't
  // select" — so on single click we select the whole line (span), and keep the
  // native behavior for drag-selection of partial text.
  useEffect(() => {
    const isTarget = (t: EventTarget | null): HTMLElement | null => {
      const target = t as HTMLElement | null;
      if (!target || !target.closest) return null;
      const layer = target.closest('.textLayer');
      if (!layer) return null;
      const span = target.tagName === 'SPAN' ? target : target.closest('span');
      return span as HTMLElement | null;
    };

    const handleClick = (e: MouseEvent) => {
      const span = isTarget(e.target);
      if (!span) return;
      // Skip programmatic/right clicks and drags (mousedown+mouseup far apart)
      if (e.button !== 0 || e.detail > 1) return;

      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      range.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(range);
    };

    const handleDblClick = (e: MouseEvent) => {
      const span = isTarget(e.target);
      if (!span) return;
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      range.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(range);
    };

    // Listen in capture phase on the document so the canvas layer's stopPropagation
    // on element clicks cannot swallow text-layer selections.
    document.addEventListener('click', handleClick, true);
    document.addEventListener('dblclick', handleDblClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('dblclick', handleDblClick, true);
    };
  }, [currentPage, pdfFile]);

  const pageDim = pageDimensions[currentPage];
  const pageRotation = pageRotations[currentPage] ?? 0;

  // If mobile, compute a render width based on container width and toolbar scale multiplier
  const renderWidth = isMobile && containerWidth && pageDim ? Math.max(100, Math.round(containerWidth * scale)) : undefined;

  // effective scale for CanvasLayer: if renderWidth is set, derive from pageDimensions, else use global scale
  const effectiveScale = renderWidth && pageDim ? renderWidth / pageDim.width : scale;

  // Canvas overlay must be rotated in sync with the rendered page (90/270 swap axes)
  const isSideways = pageRotation === 90 || pageRotation === 270;

  return (
    <div className="relative w-full h-full">
      <Document
        file={pdfFile}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={
          <div className="flex items-center justify-center p-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        }
        className="flex flex-col items-center w-full h-full"
      >
        <div
          id="pdf-page-container"
          className={`relative border shadow-2xl bg-white mx-auto my-0 ${isMobile ? 'w-full' : 'w-fit'} p-0`}
          ref={setContainerRef}
        >
          <Page
            pageNumber={currentPage}
            // On mobile we pass width so PDF is rendered to fit the container; desktop uses direct scale
            {...(renderWidth ? { width: renderWidth } : { scale })}
            rotate={pageRotation}
            className="bg-white mb-0"
            renderAnnotationLayer={false}
            renderTextLayer={true}
            onLoadSuccess={({ originalWidth, originalHeight }) => {
              setPageDimensions(currentPage, originalWidth, originalHeight);
            }}
          >
            {/* Overlay for our custom annotations. Must be absolutely positioned
                to cover the page; a relative wrapper with height:100% collapses
                because react-pdf's Page container has no explicit height. The
                z-index must exceed react-pdf's textLayer (z:2) so clicks reach us.
                In select mode the wrapper is click-transparent so the native PDF
                text layer stays selectable (CanvasLayer handles its own elements). */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 20,
                transform: `rotate(${pageRotation}deg)`,
                transformOrigin: 'center center',
                pointerEvents: activeTool === 'select' ? 'none' : 'auto',
              }}
            >
              <CanvasLayer pageIndex={currentPage} scale={effectiveScale} />
            </div>
          </Page>
        </div>
      </Document>
      <TextEditToolbar />
    </div>
  );
}

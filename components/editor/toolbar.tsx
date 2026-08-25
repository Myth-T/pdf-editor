import { useEditorStore } from "@/lib/store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Square,
  Type,
  ImageIcon,
  MousePointer2,
  Download,
  Signature,
  Circle,
  Minus,
  Shapes,
  ArrowRight,
  MoreVertical,
  Settings2,
  Copy,
  Clipboard,
  Merge,
  Split,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImageDialog } from "./image-dialog";
import { SignatureDialog } from "./signature-dialog";
import { DownloadDialog } from "./download-dialog";
import { MergeDialog } from "./merge-dialog";
import { SplitDialog } from "./split-dialog";
import { useIsMobile } from "@/hooks/use-mobile";

export function Toolbar() {
  const {
    currentPage,
    numPages,
    setCurrentPage,
    scale,
    setScale,
    activeTool,
    setActiveTool,
    pdfFile,
    selectedElementId,
    addLayer,
    selectElement
  } = useEditorStore();

  const isMobile = useIsMobile();

  // Dynamic navigation state
  const prevDisabled = currentPage <= 1;
  const nextDisabled = numPages <= 0 || currentPage >= numPages;

  const handlePrevClick = () => {
    if (!prevDisabled) setCurrentPage(Math.max(currentPage - 1, 1));
  };

  const handleNextClick = () => {
    if (!nextDisabled) setCurrentPage(Math.min(currentPage + 1, numPages));
  };

  // Helper to style toolbar icon buttons: active selection appears primary; hover is primary for inactive buttons
  const iconButtonClass = (isActive = false) =>
    cn(
      buttonVariants({ variant: isActive ? 'default' : 'ghost', size: 'icon' }),
      "h-7 w-7 sm:h-8 sm:w-8 rounded-none transition-all",
      isActive
        ? "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary dark:border-primary/30"
        : "hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/10 dark:hover:text-primary"
    );

  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);

  const handleZoomIn = () => setScale(Math.min(scale + 0.1, 3));
  const handleZoomOut = () => setScale(Math.max(scale - 0.1, 0.5));

  const handleImageTool = () => {
    setActiveTool('image');
    setImageDialogOpen(true);
  };

  const handleSignatureTool = () => {
    setActiveTool('signature');
    setSignatureDialogOpen(true);
  };

  const handleCopyClick = async () => {
    const ok = await useEditorStore.getState().copySelection();
    try {
      const { toast } = await import('sonner');
      toast(ok ? '已复制到剪贴板' : '未选中任何内容');
    } catch (err) {
      // ignore
    }
  };

  const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const tryParseInkoroHtml = (html: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const node = doc.querySelector('[data-inkoro]');
      const payload = node?.getAttribute('data-inkoro');
      if (!payload) return null;
      const decoded = decodeURIComponent(payload);
      const parsed = JSON.parse(decoded);
      if (parsed && parsed.__inkoro && Array.isArray(parsed.elements)) return parsed.elements;
    } catch (err) {
      // ignore
    }
    return null;
  };

  const getPlainTextFromHtml = (html: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return doc.body?.textContent || '';
    } catch (err) {
      return html;
    }
  };

  const handlePasteClick = async () => {
    try {
      // Try advanced Clipboard API first (image support)
      let readFailed = false;
      if ((navigator as any).clipboard && (navigator as any).clipboard.read) {
        try {
          const items: any[] = await (navigator as any).clipboard.read();
          for (const item of items) {
            // prefer images
            const imgType = item.types.find((t: string) => t.startsWith('image/'));
            if (imgType) {
              const blob = await item.getType(imgType);
              const dataUrl = await blobToDataUrl(blob);
              // approximate center placement
              const centerX = (window.innerWidth / 2) / (scale || 1);
              const centerY = (window.innerHeight / 2) / (scale || 1);
              const dims = await new Promise<{ w: number; h: number }>((res) => {
                const i = new Image();
                i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
                i.onerror = () => res({ w: 200, h: 200 });
                i.src = dataUrl;
              });
              const desiredPx = Math.min(dims.w, 300);
              const desiredPxH = Math.round(desiredPx * (dims.h / Math.max(1, dims.w)));
              const userW = desiredPx / (scale || 1);
              const userH = desiredPxH / (scale || 1);
              const id = crypto.randomUUID();
              addLayer(currentPage, { id, type: 'image', x: centerX - userW / 2, y: centerY - userH / 2, width: userW, height: userH, rotation: 0, content: dataUrl, style: { opacity: 1 } });
              selectElement(id);
              setActiveTool('select');
              try { const { toast } = await import('sonner'); toast('已粘贴图片'); } catch (err) {}
              return;
            }

            // fallback to text
            const textHtmlType = item.types.find((t: string) => t === 'text/html');
            const textPlainType = item.types.find((t: string) => t === 'text/plain');
            const textType = textHtmlType || textPlainType;
            if (textType) {
              const blob = await item.getType(textType);
              const txt = await blob.text();
              if (textType === 'text/html') {
                const inkElements = tryParseInkoroHtml(txt);
                if (inkElements) {
                  const offset = 10;
                  let lastId = null;
                  for (const el of inkElements) {
                    const clone = JSON.parse(JSON.stringify(el));
                    clone.id = crypto.randomUUID();
                    clone.x = (clone.x ?? 100) + offset;
                    clone.y = (clone.y ?? 100) + offset;
                    addLayer(currentPage, clone);
                    lastId = clone.id;
                  }
                  if (lastId) selectElement(lastId);
                  try { const { toast } = await import('sonner'); toast('已粘贴元素'); } catch (err) {}
                  return;
                }

                // Try to extract image from HTML (covers Safari where clipboard.read() returns text/html instead of image/png)
                try {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(txt, 'text/html');
                  const img = doc.querySelector('img');
                  if (img && img.src) {
                    const dataUrl = img.src;
                    const centerX = (window.innerWidth / 2) / (scale || 1);
                    const centerY = (window.innerHeight / 2) / (scale || 1);
                    const dims = await new Promise<{ w: number; h: number }>((res) => {
                      const i = new Image();
                      i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
                      i.onerror = () => res({ w: 200, h: 200 });
                      i.src = dataUrl;
                    });
                    const desiredPx = Math.min(dims.w, 300);
                    const desiredPxH = Math.round(desiredPx * (dims.h / Math.max(1, dims.w)));
                    const userW = desiredPx / (scale || 1);
                    const userH = desiredPxH / (scale || 1);
                    const id = crypto.randomUUID();
                    addLayer(currentPage, { id, type: 'image', x: centerX - userW / 2, y: centerY - userH / 2, width: userW, height: userH, rotation: 0, content: dataUrl, style: { opacity: 1 } });
                    selectElement(id);
                    setActiveTool('select');
                    try { const { toast } = await import('sonner'); toast('已粘贴图片'); } catch (err) {}
                    return;
                  }
                } catch (parseErr) {
                  // ignore parse errors
                }
              } else {
                // try to parse Inkoro JSON
                try {
                  const parsed = JSON.parse(txt);
                  if (parsed && parsed.__inkoro && Array.isArray(parsed.elements)) {
                    const offset = 10;
                    let lastId = null;
                    for (const el of parsed.elements) {
                      const clone = JSON.parse(JSON.stringify(el));
                      clone.id = crypto.randomUUID();
                      clone.x = (clone.x ?? 100) + offset;
                      clone.y = (clone.y ?? 100) + offset;
                      addLayer(currentPage, clone);
                      lastId = clone.id;
                    }
                    if (lastId) selectElement(lastId);
                    try { const { toast } = await import('sonner'); toast('已粘贴元素'); } catch (err) {}
                    return;
                  }
                } catch (err) {
                  // not JSON
                }
              }

              // plain text paste
              const id = crypto.randomUUID();
              const defaultPxWidth = 300;
              const userWidth = defaultPxWidth / (scale || 1);
              const userHeight = 30 / (scale || 1);
              const centerX = (window.innerWidth / 2) / (scale || 1);
              const centerY = (window.innerHeight / 2) / (scale || 1);
              const content = textType === 'text/html' ? getPlainTextFromHtml(txt) : txt;
              addLayer(currentPage, { id, type: 'text', x: centerX - userWidth / 2, y: centerY - userHeight / 2, width: userWidth, height: userHeight, rotation: 0, content, style: { fontSize: 16, color: '#000000' } });
              selectElement(id);
              setActiveTool('select');
              try { const { toast } = await import('sonner'); toast('已粘贴文本'); } catch (err) {}
              return;
            }
          }
        } catch (clipErr) {
          console.debug('clipboard.read() failed, falling through to readText()', clipErr);
          readFailed = true;
        }
      }

      // Fallback: read text (reached if clipboard.read is unavailable, failed, or had no data)
      if (!(navigator as any).clipboard || readFailed || !(navigator as any).clipboard.read) {
        const txt = await navigator.clipboard.readText();
        if (txt) {
          const ink = ((): any => { try { const p = JSON.parse(txt); if (p && p.__inkoro) return p; } catch (e) { return null; } })();
          if (ink && Array.isArray(ink.elements)) {
            const offset = 10;
            let lastId = null;
            for (const el of ink.elements) {
              const clone = JSON.parse(JSON.stringify(el));
              clone.id = crypto.randomUUID();
              clone.x = (clone.x ?? 100) + offset;
              clone.y = (clone.y ?? 100) + offset;
              addLayer(currentPage, clone);
              lastId = clone.id;
            }
            if (lastId) selectElement(lastId);
            try { const { toast } = await import('sonner'); toast('已粘贴元素'); } catch (err) {}
            return;
          }

          // otherwise just create text node
          const id = crypto.randomUUID();
          const defaultPxWidth = 300;
          const userWidth = defaultPxWidth / (scale || 1);
          const userHeight = 30 / (scale || 1);
          const centerX = (window.innerWidth / 2) / (scale || 1);
          const centerY = (window.innerHeight / 2) / (scale || 1);
          addLayer(currentPage, { id, type: 'text', x: centerX - userWidth / 2, y: centerY - userHeight / 2, width: userWidth, height: userHeight, rotation: 0, content: txt, style: { fontSize: 16, color: '#000000' } });
          selectElement(id);
          setActiveTool('select');
          try { const { toast } = await import('sonner'); toast('已粘贴文本'); } catch (err) {}
          return;
        }
      }
    } catch (err) {
      console.debug('Paste failed', err);
      try { const { toast } = await import('sonner'); toast('粘贴失败'); } catch (err) {}
    }
  };

  const handlePropertiesClick = () => {
    // Access the setMobilePropertiesOpen function from the store
    const setOpen = (useEditorStore.getState() as any).setMobilePropertiesOpen;
    if (setOpen) {
      setOpen(true);
    }
  };

  if (!pdfFile) return null;

  return (
    <TooltipProvider>




      <div className="fixed sm:absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 bg-background/90 dark:bg-background/80 backdrop-blur-md border shadow-lg rounded-none px-2 sm:px-2 py-1.5 sm:py-1.5 flex items-center gap-2 z-50">
        <div className="flex items-center gap-1">

          <Tooltip>
            <TooltipTrigger
              render={(props) => <button {...props} />}
              className={iconButtonClass(activeTool === 'select')}
              onClick={() => setActiveTool('select')}
              title="选择"
              aria-label="选择工具"
            >
              <MousePointer2 className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent className="hidden sm:block">选择</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={(props) => <button {...props} />}
              className={iconButtonClass(activeTool === 'text')}
              onClick={() => setActiveTool('text')}
              title="文字"
              aria-label="文字工具"
            >
              <Type className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent className="hidden sm:block">文字</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={(props) => <button {...props} />}
              className={iconButtonClass(activeTool === 'image')}
              onClick={handleImageTool}
              title="图片"
              aria-label="图片工具"
            >
              <ImageIcon className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent className="hidden sm:block">图片</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={(props) => <button {...props} />}
              className={iconButtonClass(activeTool === 'signature')}
              onClick={handleSignatureTool}
              title="签名"
              aria-label="签名工具"
            >
              <Signature className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent className="hidden sm:block">签名</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger
              nativeButton
              render={(props) => <button {...props} />}
              className={iconButtonClass(['rect', 'circle', 'line', 'arrow'].includes(activeTool || ''))}
              title="形状"
              aria-label="形状菜单"
            >
              <Shapes className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setActiveTool('rect')}>
                <Square className="h-4 w-4 mr-2" />
                矩形
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTool('circle')}>
                <Circle className="h-4 w-4 mr-2" />
                圆形
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTool('line')}>
                <Minus className="h-4 w-4 mr-2" />
                直线
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTool('arrow')}>
                <ArrowRight className="h-4 w-4 mr-2" />
                箭头
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6" />

          <Tooltip>
            <TooltipTrigger
              render={(props) => <button {...props} />}
              className={iconButtonClass(false)}
              onClick={handleCopyClick}
              title="复制"
              aria-label="复制所选"
            >
              <Copy className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent className="hidden sm:block">复制</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={(props) => <button {...props} />}
              className={iconButtonClass(false)}
              onClick={handlePasteClick}
              title="粘贴"
              aria-label="粘贴"
            >
              <Clipboard className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent className="hidden sm:block">粘贴</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Desktop: Show controls inline */}
        <div className="hidden sm:flex items-center gap-2">
          { /* Page Navigation */}
          <Tooltip>
            <TooltipTrigger
              render={(props) => <button {...props} />}
              className={cn(iconButtonClass(false), prevDisabled && "opacity-50 cursor-not-allowed pointer-events-none")}
              onClick={handlePrevClick}
              disabled={prevDisabled}
              aria-disabled={prevDisabled}
              title="上一页"
              aria-label="上一页"
            >
              <ChevronLeft className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>上一页</TooltipContent>
          </Tooltip>

          <span className="text-xs font-medium w-12 text-center select-none">
            {currentPage} / {numPages}
          </span>

          <Tooltip>
            <TooltipTrigger
              render={(props) => <button {...props} />}
              className={cn(iconButtonClass(false), nextDisabled && "opacity-50 cursor-not-allowed pointer-events-none")}
              onClick={handleNextClick}
              disabled={nextDisabled}
              aria-disabled={nextDisabled}
              title="下一页"
              aria-label="下一页"
            >
              <ChevronRight className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>下一页</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="hidden sm:block h-6" />

        <div className="hidden sm:flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={(props) => <button {...props} />}
              className={iconButtonClass(false)}
              onClick={handleZoomOut}
              title="缩小"
              aria-label="缩小"
            >
              <ZoomOut className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>缩小</TooltipContent>
          </Tooltip>

          <span className="text-xs font-medium w-12 text-center select-none">
            {Math.round(scale * 100)}%
          </span>

          <Tooltip>
            <TooltipTrigger
              render={(props) => <button {...props} />}
              className={iconButtonClass(false)}
              onClick={handleZoomIn}
              title="放大"
              aria-label="放大"
            >
              <ZoomIn className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>放大</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="hidden sm:block h-6" />

        {/* Merge / Split tools */}
        <DropdownMenu>
          <DropdownMenuTrigger
            nativeButton
            render={(props) => <button {...props} />}
            className={cn(iconButtonClass(false), "hidden sm:flex")}
            title="合并/拆分"
            aria-label="合并或拆分 PDF"
          >
            <Merge className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setMergeDialogOpen(true)}>
              <Merge className="h-4 w-4 mr-2" />
              合并 PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSplitDialogOpen(true)}>
              <Split className="h-4 w-4 mr-2" />
              拆分 PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger
            render={(props) => <button {...props} />}
            className={cn(iconButtonClass(false), "hidden sm:flex")}
            onClick={() => setDownloadDialogOpen(true)}
            title="导出"
            aria-label="导出文档"
          >
            <Download className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>导出</TooltipContent>
        </Tooltip>

        {/* Mobile: Show dropdown menu with controls */}
        <DropdownMenu>
          <DropdownMenuTrigger
            nativeButton={true}
            className={cn(iconButtonClass(false), "sm:hidden")}
            title="更多选项"
            aria-label="更多选项"
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {/* Page Navigation */}
            <div className="flex items-center justify-between px-3 py-2.5">
              <button
                onClick={handlePrevClick}
                disabled={prevDisabled}
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-none transition-colors",
                  prevDisabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium">
                第 {currentPage} / {numPages} 页
              </span>
              <button
                onClick={handleNextClick}
                disabled={nextDisabled}
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-none transition-colors",
                  nextDisabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="h-px bg-border" />

            {/* Zoom Controls */}
            <div className="flex items-center justify-between px-3 py-2.5">
              <button
                onClick={handleZoomOut}
                className="flex items-center justify-center h-8 w-8 rounded-none transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="flex items-center justify-center h-8 w-8 rounded-none transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            <div className="h-px bg-border" />

            <DropdownMenuItem onClick={handleCopyClick}>
              <Copy className="h-4 w-4 mr-2" />
              复制
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handlePasteClick}>
              <Clipboard className="h-4 w-4 mr-2" />
              粘贴
            </DropdownMenuItem>

            <div className="h-px bg-border" />

            {/* Export */}
            <DropdownMenuItem onClick={() => setDownloadDialogOpen(true)}>
              <Download className="h-4 w-4 mr-2" />
              导出
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mobile centered Properties dock above main dock with smooth slide animation */}
        <div
          className={cn(
            "fixed left-1/2 -translate-x-1/2 z-50 sm:hidden bottom-16",
            "transform-gpu transition-all duration-300 ease-in-out",
            selectedElementId ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-6 opacity-0 pointer-events-none"
          )}
          aria-hidden={!selectedElementId}
        >
          <Tooltip>
            <TooltipTrigger
              render={(props) => <button {...props} />}
              className="bg-background/90 backdrop-blur-md border shadow-lg rounded-none px-3 py-2 flex items-center gap-2"
              onClick={handlePropertiesClick}
              title="属性"
              aria-label="打开属性"
            >
              <Settings2 className="h-4 w-4" />
              <span className="text-sm">属性</span>
            </TooltipTrigger>
            <TooltipContent>属性</TooltipContent>
          </Tooltip>
        </div>

        <ImageDialog open={imageDialogOpen} onOpenChange={setImageDialogOpen} />
        <SignatureDialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen} />
        <DownloadDialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen} />
        <MergeDialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen} />
        <SplitDialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen} />
      </div>
    </TooltipProvider>
  );
}

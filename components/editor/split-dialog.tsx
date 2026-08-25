'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Split as SplitIcon, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/store";
import { splitPdf, parseRanges, SplitPart } from "@/lib/split-service";

interface SplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SplitMode = 'range' | 'each';

export function SplitDialog({ open, onOpenChange }: SplitDialogProps) {
  const { pdfFile, numPages } = useEditorStore();
  const [mode, setMode] = useState<SplitMode>('range');
  const [rangeInput, setRangeInput] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMode('range');
      setRangeInput('');
      setRangeError(null);
    }
  }, [open]);

  const downloadPart = (part: SplitPart) => {
    const blob = new Blob([part.bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = part.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSplit = useCallback(async () => {
    if (!pdfFile) return;
    setIsSplitting(true);
    setRangeError(null);
    try {
      const pdfBytes = await pdfFile.arrayBuffer();
      let groups: number[][] = [];

      if (mode === 'each') {
        groups = Array.from({ length: numPages }, (_, i) => [i + 1]);
      } else {
        const pages = parseRanges(rangeInput, numPages);
        if (!pages || pages.length === 0) {
          setRangeError('页面范围格式无效，例如：1-5, 8, 10-15');
          setIsSplitting(false);
          return;
        }
        // Split contiguous ranges into separate groups
        let current: number[] = [pages[0]];
        for (let i = 1; i < pages.length; i++) {
          if (pages[i] === current[current.length - 1] + 1) {
            current.push(pages[i]);
          } else {
            groups.push(current);
            current = [pages[i]];
          }
        }
        groups.push(current);
      }

      const parts = await splitPdf(pdfBytes, groups);
      if (parts.length === 0) {
        setRangeError('没有可拆分的页面');
        setIsSplitting(false);
        return;
      }

      for (const part of parts) downloadPart(part);

      const { toast } = await import('sonner');
      toast(`拆分完成，共生成 ${parts.length} 个文件`);
      onOpenChange(false);
    } catch (err) {
      console.error('Split failed:', err);
      try {
        const { toast } = await import('sonner');
        toast('拆分失败，请检查文件是否损坏或已加密。');
      } catch {}
    } finally {
      setIsSplitting(false);
    }
  }, [pdfFile, numPages, mode, rangeInput, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <SplitIcon className="h-4 w-4 text-muted-foreground" />
            <DialogTitle>拆分 PDF</DialogTitle>
          </div>
          <DialogDescription>
            将当前文档按页面范围拆分为多个 PDF 文件。
          </DialogDescription>
        </DialogHeader>

        {!pdfFile ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            请先加载一个 PDF 文档。
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{pdfFile.name}</span>
              <span className="text-muted-foreground">共 {numPages} 页</span>
            </div>

            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setMode('range')}
                className={cn(
                  "px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                  mode === 'range'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                按范围拆分
              </button>
              <button
                onClick={() => setMode('each')}
                className={cn(
                  "px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                  mode === 'each'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                每页一个文件
              </button>
            </div>

            {mode === 'range' ? (
              <div className="space-y-2">
                <Label htmlFor="range-input">页面范围</Label>
                <Input
                  id="range-input"
                  placeholder={`例如：1-5, 8, 10-15（共 ${numPages} 页）`}
                  value={rangeInput}
                  onChange={(e) => {
                    setRangeInput(e.target.value);
                    setRangeError(null);
                  }}
                />
                {rangeError && (
                  <p className="text-xs text-destructive">{rangeError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  连续页面会自动分为一组，每组生成一个文件。
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                将每一页拆分为独立的 PDF 文件，共 {numPages} 个。
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSplitting}
          >
            取消
          </Button>
          <Button onClick={handleSplit} disabled={isSplitting || !pdfFile}>
            {isSplitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                拆分中...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                拆分并下载
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

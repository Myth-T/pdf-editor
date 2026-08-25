'use client';

import { useCallback, useState } from 'react';
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
import { Upload, FileText, Loader2, X, GripVertical, Merge as MergeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { mergePdfs, fileToArrayBuffer } from "@/lib/merge-service";

interface MergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PickedFile {
  id: string;
  name: string;
  size: number;
  file: File;
}

export function MergeDialog({ open, onOpenChange }: MergeDialogProps) {
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (list.length === 0) {
      alert('请选择有效的 PDF 文件。');
      return;
    }
    setFiles((prev) => {
      const existing = new Set(prev.map((p) => p.name));
      const fresh = list
        .filter((f) => !existing.has(f.name))
        .map((f) => ({ id: crypto.randomUUID(), name: f.name, size: f.size, file: f }));
      return [...prev, ...fresh];
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const moveFile = (from: number, to: number) => {
    setFiles((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      alert('请至少选择两个 PDF 文件进行合并。');
      return;
    }
    setIsMerging(true);
    try {
      const inputs = await Promise.all(
        files.map(async (f) => ({ name: f.name, bytes: await fileToArrayBuffer(f.file) }))
      );
      const result = await mergePdfs(inputs);
      const blob = new Blob([result.bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'merged.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const { toast } = await import('sonner');
      toast(`合并完成，共 ${result.pageCount} 页`);
      setFiles([]);
      onOpenChange(false);
    } catch (err) {
      console.error('Merge failed:', err);
      try {
        const { toast } = await import('sonner');
        toast('合并失败，请检查文件是否损坏或已加密。');
      } catch {}
    } finally {
      setIsMerging(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <MergeIcon className="h-4 w-4 text-muted-foreground" />
            <DialogTitle>合并 PDF</DialogTitle>
          </div>
          <DialogDescription>
            选择多个 PDF 文件，按列表顺序合并为一个文档。
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-none transition-colors cursor-pointer",
            isDragOver ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
          onDrop={handleDrop}
          onClick={() => document.getElementById('merge-upload-input')?.click()}
        >
          <div className="bg-primary/10 p-4 rounded-none mb-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">点击上传或拖拽文件到此处</h3>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            支持选择多个 PDF 文件
          </p>
          <Input
            id="merge-upload-input"
            type="file"
            className="hidden"
            accept="application/pdf"
            multiple
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              文件列表（共 {files.length} 个，拖拽调整顺序）
            </Label>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {files.map((f, i) => (
                <div
                  key={f.id}
                  className={cn(
                    "flex items-center gap-2 p-2 border rounded-none bg-card",
                    dragIndex === i && "opacity-50"
                  )}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null && dragIndex !== i) moveFile(dragIndex, i);
                    setDragIndex(null);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate flex-1" title={f.name}>{f.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                  <button
                    className="p-1 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeFile(f.id)}
                    title="移除"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMerging}
          >
            取消
          </Button>
          <Button onClick={handleMerge} disabled={isMerging || files.length < 2}>
            {isMerging ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                合并中...
              </>
            ) : (
              <>
                <MergeIcon className="h-4 w-4 mr-2" />
                合并并下载
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

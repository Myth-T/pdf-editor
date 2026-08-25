'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEditorStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Loader2, X } from "lucide-react";
import { getFormFields, FormFieldInfo } from "@/lib/form-service";

export function FormPanel({ onClose }: { onClose: () => void }) {
  const { pdfFile, formValues, setFormValue, setFormFlatten, formFlatten } = useEditorStore();
  const [fields, setFields] = useState<FormFieldInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!pdfFile) return;
      setError(null);
      try {
        const buffer = await pdfFile.arrayBuffer();
        const infos = await getFormFields(buffer);
        if (cancelled) return;
        setFields(infos);
      } catch (err) {
        console.error('Failed to read form fields', err);
        if (!cancelled) setError('无法读取表单字段，文件可能已损坏或格式不受支持。');
      }
    }
    setFields(null);
    load();
    return () => {
      cancelled = true;
    };
  }, [pdfFile]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const valueFor = (name: string): string | boolean => formValues[name];

  const renderField = (field: FormFieldInfo) => {
    const name = field.name;
    const type = field.type;

    if (type === 'text') {
      const v = typeof valueFor(name) === 'string' ? (valueFor(name) as string) : (field.currentValue as string ?? '');
      return (
        <Input
          className="h-8 text-xs"
          value={v}
          onChange={(e) => setFormValue(name, e.target.value)}
        />
      );
    }

    if (type === 'checkbox') {
      const checked = typeof valueFor(name) === 'boolean' ? valueFor(name) as boolean : Boolean(field.currentValue);
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={checked}
            onCheckedChange={(c) => setFormValue(name, c)}
          />
          <span className="text-xs text-muted-foreground">{checked ? '已勾选' : '未勾选'}</span>
        </div>
      );
    }

    if (type === 'radio' || type === 'dropdown') {
      const opts = field.options ?? [];
      const current = typeof valueFor(name) === 'string'
        ? (valueFor(name) as string)
        : String(field.currentValue ?? '');
      if (opts.length === 0) {
        return <span className="text-xs text-muted-foreground">无可选项</span>;
      }
      return (
        <Select value={current || undefined} onValueChange={(v) => setFormValue(name, v)}>
          <SelectTrigger className="h-8 text-xs w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opts.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (type === 'optionlist') {
      const opts = field.options ?? [];
      const current = typeof valueFor(name) === 'string'
        ? (valueFor(name) as string)
        : String(field.currentValue ?? '');
      return (
        <Select value={current || undefined} onValueChange={(v) => setFormValue(name, v)}>
          <SelectTrigger className="h-8 text-xs w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opts.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return <span className="text-xs text-muted-foreground">此字段类型暂不支持编辑</span>;
  };

  return (
    <div className="absolute top-20 right-4 z-40 w-80 max-h-[70vh] flex flex-col bg-background/95 backdrop-blur shadow-xl border rounded-none animate-in slide-in-from-right-10 fade-in duration-200">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-semibold text-sm">表单填写</h4>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : fields === null ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : fields.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            此文档没有可填写的表单字段。
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              共 {fields.length} 个表单字段，填写后导出将保留。
            </p>
            {fields.map((field) => (
              <div key={field.name} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground block truncate" title={field.name}>
                  {field.name}
                </Label>
                {renderField(field)}
              </div>
            ))}
          </>
        )}
      </div>

      <Separator />

      <div className="p-4 space-y-2 border-t">
        <div className="flex items-center justify-between">
          <Label htmlFor="form-flatten" className="cursor-pointer text-xs">
            导出时扁平化表单（字段变为静态内容）
          </Label>
          <Switch
            id="form-flatten"
            checked={formFlatten}
            onCheckedChange={setFormFlatten}
          />
        </div>
      </div>
    </div>
  );
}

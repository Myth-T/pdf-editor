'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Lock, Unlock } from "lucide-react";
import { useEditorStore } from "@/lib/store";
import { encryptPdf, decryptPdf, downloadPdfBytes } from "@/lib/encrypt-service";
import { savePdf } from "@/lib/pdf-utils";

interface EncryptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EncryptDialog({ open, onOpenChange }: EncryptDialogProps) {
  const { pdfFile } = useEditorStore();

  // Encrypt tab state
  const [userPassword, setUserPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(true);
  const [allowModifying, setAllowModifying] = useState(true);
  const [allowFilling, setAllowFilling] = useState(true);

  // Decrypt tab state
  const [decryptPassword, setDecryptPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setUserPassword('');
    setOwnerPassword('');
    setAllowPrinting(true);
    setAllowCopying(true);
    setAllowModifying(true);
    setAllowFilling(true);
    setDecryptPassword('');
    setError(null);
  };

  const handleEncrypt = async () => {
    if (!pdfFile) return;
    if (!userPassword) {
      setError('请输入用户密码。');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      // First apply annotations/metadata via the normal pipeline, then encrypt the result
      const editedBytes = (await savePdf({ returnBytes: true })) as Uint8Array | undefined;
      if (!editedBytes) throw new Error('无法生成编辑后的 PDF');

      const encrypted = await encryptPdf(editedBytes.buffer as ArrayBuffer, {
        userPassword,
        ownerPassword: ownerPassword || undefined,
        permissions: {
          printing: allowPrinting ? 'high' : 'low',
          copying: allowCopying,
          modifying: allowModifying,
          fillingForms: allowFilling,
        },
      });

      downloadPdfBytes(encrypted, 'encrypted.pdf');
      const { toast } = await import('sonner');
      toast('已导出加密 PDF');
      onOpenChange(false);
    } catch (err) {
      console.error('Encrypt failed:', err);
      setError('加密失败，请重试。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecrypt = async () => {
    if (!pdfFile) return;
    if (!decryptPassword) {
      setError('请输入文档密码。');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const buffer = await pdfFile.arrayBuffer();
      const decrypted = await decryptPdf(buffer, decryptPassword);
      downloadPdfBytes(decrypted, 'decrypted.pdf');
      const { toast } = await import('sonner');
      toast('已导出解密后的 PDF');
      onOpenChange(false);
    } catch (err) {
      console.error('Decrypt failed:', err);
      setError((err as Error)?.message || '解密失败，请确认密码正确。');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isProcessing) {
          onOpenChange(o);
          if (!o) reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <DialogTitle>PDF 加密 / 解密</DialogTitle>
          </div>
          <DialogDescription>
            为文档设置密码保护，或移除已有密码。
          </DialogDescription>
        </DialogHeader>

        {!pdfFile ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            请先加载一个 PDF 文档。
          </div>
        ) : (
          <Tabs defaultValue="encrypt" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="encrypt">
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                加密
              </TabsTrigger>
              <TabsTrigger value="decrypt">
                <Unlock className="h-3.5 w-3.5 mr-1.5" />
                解密
              </TabsTrigger>
            </TabsList>

            <TabsContent value="encrypt" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="user-pass">用户密码（打开文档需要）</Label>
                <Input
                  id="user-pass"
                  type="password"
                  placeholder="至少 4 位"
                  value={userPassword}
                  onChange={(e) => { setUserPassword(e.target.value); setError(null); }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-pass">所有者密码（可选，修改权限需要）</Label>
                <Input
                  id="owner-pass"
                  type="password"
                  placeholder="留空则与用户密码相同"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">允许的权限</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="perm-print" className="cursor-pointer text-sm">打印</Label>
                    <Switch id="perm-print" checked={allowPrinting} onCheckedChange={setAllowPrinting} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="perm-copy" className="cursor-pointer text-sm">复制文本/图片</Label>
                    <Switch id="perm-copy" checked={allowCopying} onCheckedChange={setAllowCopying} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="perm-modify" className="cursor-pointer text-sm">修改文档</Label>
                    <Switch id="perm-modify" checked={allowModifying} onCheckedChange={setAllowModifying} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="perm-fill" className="cursor-pointer text-sm">填写表单</Label>
                    <Switch id="perm-fill" checked={allowFilling} onCheckedChange={setAllowFilling} />
                  </div>
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button
                className="w-full"
                onClick={handleEncrypt}
                disabled={isProcessing || !userPassword}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    加密并导出
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="decrypt" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="decrypt-pass">文档密码</Label>
                <Input
                  id="decrypt-pass"
                  type="password"
                  placeholder="输入打开文档的密码"
                  value={decryptPassword}
                  onChange={(e) => { setDecryptPassword(e.target.value); setError(null); }}
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button
                className="w-full"
                onClick={handleDecrypt}
                disabled={isProcessing || !decryptPassword}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <Unlock className="h-4 w-4 mr-2" />
                    解密并导出
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

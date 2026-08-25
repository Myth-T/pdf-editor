'use client';

import * as React from 'react';
import { Info, Globe } from 'lucide-react';
import { siGithub, siInstagram } from 'simple-icons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDialogStore } from '@/hooks/use-dialogs';

export function AboutDialog() {
  const { aboutOpen, setAboutOpen } = useDialogStore();

  return (
    <Dialog open={aboutOpen} onOpenChange={(open) => setAboutOpen(open)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <DialogTitle>关于 Inkoro</DialogTitle>
          </div>
          <DialogDescription>
            基于 react-pdf (pdf.js)、Tailwind 和 shadcn/ui 构建的轻量级 React + TypeScript PDF 编辑器。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div>
            <h3 className="font-semibold mb-2 text-base">功能特性</h3>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>向 PDF 添加文字、形状、图片和签名</li>
              <li>拖拽元素精确定位</li>
              <li>实时编辑，支持撤销/重做</li>
              <li>即时导出编辑后的 PDF</li>
              <li>深色模式支持</li>
              <li>刷新页面后会话保持</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-base">技术栈</h3>
            <div className="flex flex-wrap gap-2">
              {['TanStack Start', 'React', 'TypeScript', 'Tailwind', 'pdf-lib', 'react-pdf', 'Zustand', 'shadcn/ui'].map((tech) => (
                <span key={tech} className="px-2 py-1 bg-muted rounded-none text-xs">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-base">联系</h3>
            <div className="flex gap-3">
              <a
                href="https://github.com/KurutoDenzeru/Inkoro"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-none border hover:bg-muted transition-colors"
              >
                <svg role="img" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
                  <path d={siGithub.path} />
                </svg>
                <span className="text-xs">GitHub</span>
              </a>
              <a
                href="https://www.instagram.com/krtclcdy/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-none border hover:bg-muted transition-colors"
              >
                <svg role="img" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
                  <path d={siInstagram.path} />
                </svg>
                <span className="text-xs">Instagram</span>
              </a>
              <a
                href="https://kurtcalacday.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-none border hover:bg-muted transition-colors"
              >
                <Globe className="h-4 w-4 shrink-0" />
                <span className="text-xs">Portfolio</span>
              </a>
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAboutOpen(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

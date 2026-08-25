'use client';

import { pdfjs } from 'react-pdf';

if (typeof window !== 'undefined') {
  // Load the worker from our own public/ directory so the app works offline
  // and is not dependent on an external CDN.
  pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs?v=${pdfjs.version}`;
}

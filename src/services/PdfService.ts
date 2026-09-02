import * as pdfjs from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

// Vite-friendly worker loading
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export const pdfService = {
  private: {
    docCache: new Map<string, { doc: pdfjs.PDFDocumentProxy, size: number }>()
  },

  async loadDocument(blob: Blob | ArrayBuffer, cacheKey?: string) {
    const size = blob instanceof Blob ? blob.size : blob.byteLength;
    if (cacheKey) {
      const cached = this.private.docCache.get(cacheKey);
      if (cached && cached.size === size) {
        return cached.doc;
      }
    }

    try {
      const arrayBuffer = blob instanceof Blob ? await blob.arrayBuffer() : blob;
      const loadingTask = pdfjs.getDocument({ 
        data: arrayBuffer,
        useSystemFonts: true,
        isEvalSupported: false
      });
      const doc = await loadingTask.promise;
      
      if (cacheKey) {
        this.private.docCache.set(cacheKey, { doc, size });
      }
      
      return doc;
    } catch (err) {
      console.error('PdfService Load Error:', err);
      throw err;
    }
  },

  async slicePdf(sourceBlob: Blob, startPage: number, endPage: number): Promise<Blob> {
    try {
      const arrayBuffer = await sourceBlob.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const newPdfDoc = await PDFDocument.create();
      
      // Page numbers are 1-based in the UI, 0-based in pdf-lib
      const pagesToCopy = Array.from(
        { length: endPage - startPage + 1 }, 
        (_, i) => startPage - 1 + i
      );

      const copiedPages = await newPdfDoc.copyPages(pdfDoc, pagesToCopy);
      copiedPages.forEach(page => newPdfDoc.addPage(page));

      const pdfBytes = await newPdfDoc.save();
      // Using 'as any' to bypass the SharedArrayBuffer check which is causing issues with BlobPart[]
      return new Blob([pdfBytes as any], { type: 'application/pdf' });
    } catch (err) {
      console.error('PdfService Slice Error:', err);
      throw err;
    }
  },

  async renderPage(pdfDoc: pdfjs.PDFDocumentProxy, pageNumber: number, canvas: HTMLCanvasElement, scale = 1.5) {
    try {
      const page = await pdfDoc.getPage(pageNumber);
      // Let PDF.js handle rotation automatically by not passing a rotation override
      const viewport = page.getViewport({ scale });
      
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Could not get canvas context');

      // Sync canvas dimensions with viewport
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas
      };

      return page.render(renderContext);
    } catch (err) {
      console.error('PdfService Render Setup Error:', err);
      throw err;
    }
  },

  clearCache() {
    this.private.docCache.clear();
  }
};

import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { pdfService } from '../services/PdfService';

export const PDFViewer: React.FC<{ blob: Blob | ArrayBuffer, pageNumber: number, id?: string }> = ({ blob, pageNumber, id = 'default' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentRenderTask = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const render = async (containerWidth: number) => {
    if (!containerRef.current || containerWidth === 0) return;
    
    if (currentRenderTask.current) {
      try { await currentRenderTask.current.cancel(); } catch (e) {}
    }

    setLoading(true);
    setError(null);

    try {
      let pdfData: any = blob;
      if (blob instanceof Uint8Array) pdfData = blob.buffer;
      const pdfBlob = pdfData instanceof ArrayBuffer ? new Blob([pdfData], { type: 'application/pdf' }) : pdfData;
      
      const pdfDoc = await pdfService.loadDocument(pdfBlob, id);
      const page = await pdfDoc.getPage(pageNumber);
      
      const unscaledViewport = page.getViewport({ scale: 1.0, rotation: page.rotate });
      const scale = (containerWidth - 4) / unscaledViewport.width;
      const viewport = page.getViewport({ scale, rotation: page.rotate });

      if (canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('No context');

        const task = page.render({ canvasContext: context, viewport, canvas });
        currentRenderTask.current = task;
        await task.promise;
      }
    } catch (err: any) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('PDF Error:', err);
        setError(err.message || 'Render failed');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timeoutId: any;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => render(width), 100);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
      if (currentRenderTask.current) currentRenderTask.current.cancel();
    };
  }, [blob, pageNumber, id]);

  return (
    <div className="pdf-viewer-wrapper" ref={containerRef}>
      {loading && (
        <div className="pdf-loading-overlay">
          <Loader2 className="animate-spin" size={20} />
          <span>Rendering...</span>
        </div>
      )}
      {error && <div className="error-overlay">⚠️ {error}</div>}
      <canvas ref={canvasRef} className="pdf-canvas" />
    </div>
  );
};

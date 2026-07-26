import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download } from 'lucide-react';

export interface LightboxImage {
  /** Optional caption shown above the image (e.g. "تقرير InBody"). */
  title?: string;
  url: string;
  alt?: string;
  caption?: string;
}

interface LightboxProps {
  images: LightboxImage[];
  startIndex?: number;
  onClose: () => void;
}

/**
 * Full-screen image viewer with zoom, pan, and arrow navigation.
 *
 * Used by:
 *  - InBody / progress photos (Client + Admin)
 *  - Champions Feed (when an image is tapped)
 *
 * Click anywhere on the backdrop to close. ESC also closes. Arrow keys move
 * between images when more than one is provided. Two-finger / wheel zoom is
 * supported, and the image can be dragged while zoomed in.
 */
export default function Lightbox({ images, startIndex = 0, onClose }: LightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  const current = images[index];
  const hasMany = images.length > 1;

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setImgError(false);
    setImgLoading(true);
  }, [images.length]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setImgError(false);
    setImgLoading(true);
  }, [images.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && hasMany) prev(); // RTL: right = previous
      else if (e.key === 'ArrowLeft' && hasMany) next();
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 0.5, 5));
      else if (e.key === '-') setZoom((z) => Math.max(z - 0.5, 1));
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, next, prev, hasMany]);

  if (!current) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setZoom((z) => Math.min(Math.max(z + delta, 1), 5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setDragStart(null);

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm flex items-center justify-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Top toolbar */}
        <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="text-white text-sm font-bold">
            {hasMany ? `${index + 1} / ${images.length}` : ''}
            {current.caption && <span className="ms-3 text-slate-300 font-medium">{current.caption}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.5, 1))}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition"
              title="تصغير"
            >
              <ZoomOut size={18} />
            </button>
            <span className="text-white/70 text-xs font-bold tabular-nums w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.5, 5))}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition"
              title="تكبير"
            >
              <ZoomIn size={18} />
            </button>
            <a
              href={current.url}
              download
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition"
              title="تحميل"
              onClick={(e) => e.stopPropagation()}
            >
              <Download size={18} />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/90 hover:text-white hover:bg-white/10 transition"
              title="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Prev / Next arrows */}
        {hasMany && (
          <>
            <button
              onClick={prev}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/40 hover:bg-black/70 text-white transition"
              title="السابق"
            >
              <ChevronRight size={24} />
            </button>
            <button
              onClick={next}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/40 hover:bg-black/70 text-white transition"
              title="التالي"
            >
              <ChevronLeft size={24} />
            </button>
          </>
        )}

        {/* Image */}
        <div
          className="relative max-w-[95vw] max-h-[88vh] flex items-center justify-center select-none"
          onWheel={handleWheel}
          onMouseDown={!imgError ? handleMouseDown : undefined}
          onMouseMove={!imgError ? handleMouseMove : undefined}
          onMouseUp={!imgError ? handleMouseUp : undefined}
          onMouseLeave={!imgError ? handleMouseUp : undefined}
          onDoubleClick={() => {
            if (imgError) return;
            setZoom(zoom > 1 ? 1 : 2);
            setOffset({ x: 0, y: 0 });
          }}
          style={{ cursor: imgError ? 'default' : zoom > 1 ? (dragStart ? 'grabbing' : 'grab') : 'zoom-in' }}
        >
          {imgLoading && !imgError && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
          {imgError ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-white/70 text-center">
              <span className="text-5xl">🖼️</span>
              <p className="text-sm font-bold">تعذّر تحميل الصورة</p>
              <p className="text-xs opacity-60 max-w-xs">قد يكون الرابط منتهي الصلاحية أو الصورة محذوفة.</p>
              {current.url && (
                <a
                  href={current.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-400 underline mt-1"
                >
                  فتح الرابط في تبويب جديد
                </a>
              )}
            </div>
          ) : (
            <motion.img
              key={current.url}
              src={current.url}
              alt={current.alt || ''}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: imgLoading ? 0 : 1, scale: 1 }}
              transition={{ duration: 0.18 }}
              draggable={false}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              className="max-w-[95vw] max-h-[88vh] object-contain rounded-lg shadow-2xl"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transition: dragStart ? 'none' : 'transform 120ms ease-out',
              }}
              onLoad={() => setImgLoading(false)}
              onError={() => { setImgError(true); setImgLoading(false); }}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Convenience hook: returns a Lightbox controller you can wire to onClick
 * handlers on thumbnail images.
 *
 * Usage:
 *   const lb = useLightbox();
 *   <img onClick={() => lb.open([{ url }])} />
 *   {lb.element}
 */
export function useLightbox() {
  const [state, setState] = useState<{ images: LightboxImage[]; startIndex: number } | null>(null);

  const open = (images: LightboxImage[], startIndex = 0) => {
    if (!images || images.length === 0) return;
    // Drop entries with empty / undefined URLs to prevent broken-image crashes.
    const safe = images.filter((img) => img?.url && img.url.length > 0);
    if (safe.length === 0) return;
    const safeStart = Math.min(startIndex, safe.length - 1);
    setState({ images: safe, startIndex: safeStart });
  };

  const close = () => setState(null);

  const element = state ? (
    <Lightbox images={state.images} startIndex={state.startIndex} onClose={close} />
  ) : null;

  return { open, close, element };
}

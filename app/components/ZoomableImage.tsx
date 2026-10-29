"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const BUTTON_STEP = 0.5;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 8;

const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

interface Point { x: number; y: number }

interface ZoomableImageProps {
  src: string;
  alt: string;
}

// An image that fills its parent and can be zoomed AND panned:
//   • + / − / reset buttons
//   • double-click / double-tap (toggles 1× ↔ 2.5×)
//   • pinch on touch screens, Ctrl/⌘ + wheel (also trackpad pinch)
//   • drag to pan; mouse wheel / scrollbars scroll normally once zoomed
// The parent must give it a definite height (it is absolutely positioned inside
// a relative box that fills the parent). Remount with a new `key` per image to
// reset the zoom.
export default function ZoomableImage({ src, alt }: ZoomableImageProps) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1); // latest zoom, readable from event handlers
  const scroller = useRef<HTMLDivElement>(null);

  // Content point to keep under a screen point while the zoom change renders.
  const anchor = useRef<{ cx: number; cy: number; fx: number; fy: number } | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const moved = useRef(0);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  // Zoom to `next`, keeping `focal` (viewport coords; default centre) in place.
  const applyZoom = useCallback((next: number, focal?: Point) => {
    const el = scroller.current;
    if (!el) return;
    const z = clamp(next);
    if (z === zoomRef.current) return;
    const fx = focal?.x ?? el.clientWidth / 2;
    const fy = focal?.y ?? el.clientHeight / 2;
    anchor.current = {
      cx: (el.scrollLeft + fx) / el.scrollWidth,
      cy: (el.scrollTop + fy) / el.scrollHeight,
      fx,
      fy,
    };
    zoomRef.current = z;
    setZoom(z);
  }, []);

  // After the new size is laid out, restore the anchored point.
  useLayoutEffect(() => {
    const el = scroller.current;
    const a = anchor.current;
    if (!el || !a) return;
    el.scrollLeft = a.cx * el.scrollWidth - a.fx;
    el.scrollTop = a.cy * el.scrollHeight - a.fy;
    anchor.current = null;
  }, [zoom]);

  // Ctrl/⌘ + wheel (and trackpad pinch, which arrives as ctrl+wheel). Needs a
  // non-passive listener so we can stop the browser zooming the whole page.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // plain wheel scrolls the zoomed image natively
      e.preventDefault();
      const r = el.getBoundingClientRect();
      applyZoom(zoomRef.current * (e.deltaY < 0 ? 1.15 : 1 / 1.15), {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  const rel = (e: React.PointerEvent): Point => {
    const r = scroller.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const el = scroller.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: zoomRef.current };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
      moved.current = 0;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = scroller.current;
    if (!el || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const r = el.getBoundingClientRect();
      applyZoom(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist), {
        x: (a.x + b.x) / 2 - r.left,
        y: (a.y + b.y) / 2 - r.top,
      });
      moved.current = Infinity; // a pinch is never a tap
      return;
    }

    const d = drag.current;
    if (!d) return;
    moved.current = Math.max(moved.current, Math.hypot(e.clientX - d.x, e.clientY - d.y));
    if (zoomRef.current > 1) {
      el.scrollLeft = d.left - (e.clientX - d.x);
      el.scrollTop = d.top - (e.clientY - d.y);
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    const el = scroller.current;
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    pinch.current = null;

    // A quick, nearly-still press-and-release is a tap; two in a row zooms.
    const wasTap = e.type === "pointerup" && drag.current && moved.current < TAP_SLOP_PX;
    if (wasTap) {
      const now = Date.now();
      const prev = lastTap.current;
      if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30) {
        lastTap.current = null;
        applyZoom(zoomRef.current > 1 ? 1 : DOUBLE_TAP_ZOOM, rel(e));
      } else {
        lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      }
    }

    // Lifting one finger of a pinch: carry on panning with the other.
    const rest = [...pointers.current.values()][0];
    drag.current =
      rest && el ? { x: rest.x, y: rest.y, left: el.scrollLeft, top: el.scrollTop } : null;
  };

  const btn =
    "w-8 h-8 flex items-center justify-center bg-white/90 border border-[#1A1A1A]/20 text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div className="relative w-full h-full">
      <div
        ref={scroller}
        className={`absolute inset-0 overflow-auto ${zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        // We handle every gesture ourselves (pan, pinch, double-click/tap); this
        // also stops the page behind the modal scrolling while the image is touched.
        style={{ touchAction: "none", overscrollBehavior: "contain" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div
          className="flex items-center justify-center"
          style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="w-full h-full object-contain select-none"
          />
        </div>
      </div>

      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button type="button" aria-label="Zoom out" className={btn} disabled={zoom <= MIN_ZOOM} onClick={() => applyZoom(zoomRef.current - BUTTON_STEP)}>
          <ZoomOut className="w-4 h-4" />
        </button>
        <button type="button" aria-label="Zoom in" className={btn} disabled={zoom >= MAX_ZOOM} onClick={() => applyZoom(zoomRef.current + BUTTON_STEP)}>
          <ZoomIn className="w-4 h-4" />
        </button>
        <button type="button" aria-label="Reset zoom" className={btn} disabled={zoom === 1} onClick={() => applyZoom(1)}>
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-[#1A1A1A]/80 text-[#FBFBFA] text-[9px] uppercase tracking-widest px-2 py-1 pointer-events-none whitespace-nowrap">
        {zoom > 1 ? `${Math.round(zoom * 100)}% · drag to move` : "Double-click or pinch to zoom"}
      </div>
    </div>
  );
}

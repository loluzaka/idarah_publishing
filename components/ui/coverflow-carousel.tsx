"use client";

// Coverflow carousel: the centre slide faces you, neighbours fan out and turn
// toward it. A single requestAnimationFrame loop eases a float position toward
// the target and writes transforms straight to the DOM, so React re-renders only
// when the *active slide* changes — never per frame. The loop sleeps when the
// carousel is at rest or the tab is hidden.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface CoverflowSlide {
  src: string; // cover image URL
  alt: string; // book title / alt description
  title?: string;
  subtitle?: string; // author or category
  meta?: { label: string; value: string }[]; // e.g. Year, Price, Language
}

export interface CoverflowCarouselProps {
  slides: CoverflowSlide[];
  className?: string;
  /** Title, subtitle and meta of the active slide, under the stage. */
  showCaption?: boolean;
  /** Previous / next buttons. */
  showNavigation?: boolean;
  /** Dots (or "3 / 24" when there are too many). */
  showPagination?: boolean;
  /** Wrap around at both ends. */
  loop?: boolean;
  initialIndex?: number;
  /** Fired when the centre slide is clicked / Enter is pressed (e.g. open the book). */
  onSlideClick?: (index: number) => void;
  /** Fired when the active slide changes. */
  onChange?: (index: number) => void;
}

const K = 6; // spring stiffness: pos += (target - pos) * (1 - e^(-K·dt))
const MAX_DT = 0.05; // clamp so a stalled tab doesn't teleport the carousel
const DRAG_PX = 6;
const MAX_DOTS = 12;
const ROTATE = 52; // degrees of the neighbouring slides

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mod = (v: number, n: number) => ((v % n) + n) % n;
/** Shortest signed distance on a ring of n items, in [-n/2, n/2). */
const wrap = (v: number, n: number) => mod(v + n / 2, n) - n / 2;

export function CoverflowCarousel({
  slides,
  className,
  showCaption = true,
  showNavigation = true,
  showPagination = true,
  loop = true,
  initialIndex = 0,
  onSlideClick,
  onChange,
}: CoverflowCarouselProps) {
  const n = slides.length;
  const start = n ? clamp(initialIndex, 0, n - 1) : 0;
  const [active, setActive] = useState(start);

  const rootRef = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const size = useRef({ w: 220, h: 308 });
  const sim = useRef({ pos: start, target: start, raf: 0, last: 0, active: start });
  const frameRef = useRef<(t: number) => void>(() => {});
  const reduced = useRef(false);
  const drag = useRef({ down: false, id: 0, x0: 0, t0: 0, moved: 0, lastX: 0, lastT: 0, vx: 0 });
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cb = useRef({ onChange, loop });

  useIsoLayoutEffect(() => {
    cb.current = { onChange, loop };
  });

  /** Offset of slide i from the (float) position, wrapped when looping. */
  const offset = useCallback((i: number, pos: number) => (cb.current.loop ? wrap(i - pos, n) : i - pos), [n]);

  const apply = useCallback(() => {
    const { pos } = sim.current;
    const { w } = size.current;
    for (let i = 0; i < n; i++) {
      const el = items.current[i];
      if (!el) continue;
      const d = offset(i, pos);
      const a = Math.abs(d);
      const side = Math.sign(d);
      const near = Math.min(a, 1); // 0 = centred, 1 = fully turned
      // First neighbour sits just outside the centre cover; the rest tuck behind.
      const x = side * (near * w * 0.62 + Math.max(a - 1, 0) * w * 0.26);
      const z = -near * 140 - Math.max(a - 1, 0) * 50;
      const rotate = -side * near * ROTATE;
      const scale = 1 - near * 0.06;
      el.style.transform = `translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px) rotateY(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      el.style.opacity = String(clamp(1 - (a - 2.4) / 1.4, 0, 1));
      el.style.zIndex = String(1000 - Math.round(a * 10));
      el.style.pointerEvents = a > 3.5 ? "none" : "auto";
      el.style.setProperty("--dim", (near * 0.28).toFixed(3));
    }
  }, [n, offset]);

  useIsoLayoutEffect(() => {
    frameRef.current = (t: number) => {
      const m = sim.current;
      const dt = clamp((t - m.last) / 1000, 0, MAX_DT);
      m.last = t;
      m.pos += (m.target - m.pos) * (reduced.current ? 1 : 1 - Math.exp(-K * dt));
      if (Math.abs(m.target - m.pos) < 0.0005) m.pos = m.target;
      apply();
      if (n) {
        const a = cb.current.loop ? mod(Math.round(m.target), n) : clamp(Math.round(m.target), 0, n - 1);
        if (a !== m.active) {
          m.active = a;
          setActive(a);
          cb.current.onChange?.(a);
        }
      }
      m.raf = m.pos !== m.target ? requestAnimationFrame((tt) => frameRef.current(tt)) : 0;
    };
  }, [apply, n]);

  /** Wake the loop (it stops itself when settled). */
  const kick = useCallback(() => {
    const m = sim.current;
    if (m.raf || document.hidden) return;
    m.last = performance.now();
    m.raf = requestAnimationFrame((t) => frameRef.current(t));
  }, []);

  const go = useCallback((target: number) => {
    sim.current.target = cb.current.loop ? target : clamp(target, 0, Math.max(n - 1, 0));
    kick();
  }, [kick, n]);
  const step = useCallback((d: number) => go(Math.round(sim.current.target) + d), [go]);
  const goToIndex = useCallback((i: number) => {
    const base = Math.round(sim.current.target);
    go(cb.current.loop ? base + wrap(i - base, n) : i);
  }, [go, n]);

  // Measure the stage and lay the slides out before first paint.
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const w = Math.round(clamp(root.clientWidth * 0.34, 150, 270));
      size.current = { w, h: Math.round(w * 1.4) };
      root.style.setProperty("--cf-w", `${w}px`);
      root.style.setProperty("--cf-h", `${size.current.h}px`);
      apply();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [apply]);

  // Pause when hidden; honour reduced motion; clean up timers.
  useEffect(() => {
    const m = sim.current;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => { reduced.current = mq.matches; };
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(m.raf);
        m.raf = 0;
      } else kick();
    };
    onMq();
    mq.addEventListener("change", onMq);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      cancelAnimationFrame(m.raf);
      m.raf = 0;
      clearTimeout(wheelTimer.current);
    };
  }, [kick]);

  // Trackpad / shift-wheel sideways scroll. Vertical wheel is left to the page.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      go(sim.current.target + e.deltaX / 260);
      clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => go(Math.round(sim.current.target)), 140);
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [go]);

  // ── pointer: drag / swipe with flick momentum ──────────────────────────
  const unit = () => size.current.w * 0.5; // px of drag per slide

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    Object.assign(drag.current, { down: true, id: e.pointerId, x0: e.clientX, t0: sim.current.target, moved: 0, lastX: e.clientX, lastT: performance.now(), vx: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.down || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    d.moved = Math.max(d.moved, Math.abs(dx));
    if (d.moved <= DRAG_PX) return;
    const root = rootRef.current;
    if (root && !root.hasPointerCapture(e.pointerId)) root.setPointerCapture(e.pointerId);
    go(d.t0 - dx / unit());
    const now = performance.now();
    d.vx = d.vx * 0.6 + (((e.clientX - d.lastX) / Math.max(now - d.lastT, 1)) * 1000) * 0.4;
    d.lastX = e.clientX;
    d.lastT = now;
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d.down) return;
    d.down = false;
    if (d.moved > DRAG_PX) go(Math.round(sim.current.target - (d.vx / unit()) * 0.2));
    setTimeout(() => { d.moved = 0; }, 0); // the click that follows a drag still sees `moved`
  };

  const onSlide = (i: number) => {
    if (drag.current.moved > DRAG_PX) return; // that was a swipe
    if (i === sim.current.active) onSlideClick?.(i);
    else goToIndex(i);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(n - 1); }
    else if ((e.key === "Enter" || e.key === " ") && onSlideClick) { e.preventDefault(); onSlideClick(sim.current.active); }
  };

  if (!n) return null;
  const current = slides[active] ?? slides[0];
  const canPrev = loop || active > 0;
  const canNext = loop || active < n - 1;

  return (
    <div
      className={cn("relative w-full select-none", className)}
      role="group"
      aria-roledescription="carousel"
      aria-label="Featured publications"
    >
      <div
        ref={rootRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        // pan-y: vertical page scroll still works on touch; horizontal swipes belong to the carousel.
        style={{ touchAction: "pan-y", perspective: "1400px", height: "calc(var(--cf-h, 308px) + 48px)" }}
        className="relative mx-auto w-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#7D5A34]/60"
      >
        <div className="pointer-events-none absolute inset-x-[10%] bottom-4 h-5 rounded-[50%] bg-black/15 blur-xl" aria-hidden="true" />
        {slides.map((s, i) => (
          <div
            key={`${s.src}-${i}`}
            ref={(el) => { items.current[i] = el; }}
            role="button"
            tabIndex={-1}
            aria-label={s.alt}
            aria-current={i === active}
            onClick={() => onSlide(i)}
            className="absolute left-1/2 top-3 cursor-pointer will-change-transform"
            style={{ width: "var(--cf-w, 220px)", height: "var(--cf-h, 308px)", marginLeft: "calc(var(--cf-w, 220px) / -2)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- URL comes pre-sized/cropped from the Sanity CDN */}
            <img
              src={s.src}
              alt={s.alt}
              draggable={false}
              loading={Math.abs(i - start) <= 4 ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full rounded-[3px] object-cover shadow-[0_18px_40px_-14px_rgba(26,26,26,0.55)]"
            />
            {/* Neighbours fall into soft shadow; the centre cover stays bright. */}
            <div className="pointer-events-none absolute inset-0 rounded-[3px] bg-[#1A1A1A]" style={{ opacity: "var(--dim, 0)" }} />
            {/* Hardback hinge highlight */}
            <div className="pointer-events-none absolute inset-0 rounded-[3px] bg-gradient-to-r from-black/20 via-transparent via-[8%] to-transparent" />
          </div>
        ))}

        {showNavigation && n > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous book"
              disabled={!canPrev}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => step(-1)}
              className="absolute left-2 top-1/2 z-[2000] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#1A1A1A]/20 bg-white/90 text-[#1A1A1A] shadow-sm transition hover:bg-[#1A1A1A] hover:text-white disabled:pointer-events-none disabled:opacity-30 md:left-4"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next book"
              disabled={!canNext}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => step(1)}
              className="absolute right-2 top-1/2 z-[2000] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#1A1A1A]/20 bg-white/90 text-[#1A1A1A] shadow-sm transition hover:bg-[#1A1A1A] hover:text-white disabled:pointer-events-none disabled:opacity-30 md:right-4"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {showCaption && (
        <div className="mx-auto mt-2 max-w-2xl px-4 text-center" aria-live="polite">
          {current.title && <h3 className="font-serif text-xl leading-tight md:text-2xl" dir="auto">{current.title}</h3>}
          {current.subtitle && (
            <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1A1A1A]/60" dir="auto">{current.subtitle}</p>
          )}
          {current.meta && current.meta.length > 0 && (
            <dl className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-sans text-[11px] uppercase tracking-wider text-[#1A1A1A]/70">
              {current.meta.map((m) => (
                <div key={m.label} className="flex items-baseline gap-1.5">
                  <dt className="text-[#1A1A1A]/40">{m.label}</dt>
                  <dd className="font-bold text-[#1A1A1A]">{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {showPagination && n > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 font-sans text-[11px] tabular-nums tracking-widest text-[#1A1A1A]/60">
          {n <= MAX_DOTS ? (
            slides.map((s, i) => (
              <button
                key={`${s.src}-${i}`}
                type="button"
                aria-label={`Go to ${s.alt}`}
                aria-current={i === active}
                onClick={() => goToIndex(i)}
                className={cn("h-1.5 rounded-full transition-all", i === active ? "w-7 bg-[#7D5A34]" : "w-2.5 bg-[#1A1A1A]/25 hover:bg-[#1A1A1A]/45")}
              />
            ))
          ) : (
            <span>{String(active + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default CoverflowCarousel;

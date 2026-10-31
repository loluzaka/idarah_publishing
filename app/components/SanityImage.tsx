"use client";

// next/image for Sanity assets.
//
// A custom loader points every srcset entry straight at Sanity's CDN with
// `?w=<width>&auto=format&q=<quality>` (WebP/AVIF negotiated per browser), so
// nothing is proxied through a Netlify function and hotspot/crop params from
// urlFor() are preserved. Width/height are read from the asset id so the layout
// is reserved before the image loads (no CLS).

import Image, { type ImageLoaderProps } from "next/image";
import type { SanityImageSource } from "@sanity/image-url";
import { urlFor } from "@/app/sanityClient";

export function sanityLoader({ src, width, quality }: ImageLoaderProps): string {
  const u = new URL(src);
  u.searchParams.set("w", String(width));
  u.searchParams.set("auto", "format");
  u.searchParams.set("q", String(quality ?? 75));
  return u.toString();
}

/** Intrinsic size encoded in an asset id: "image-<hash>-1920x600-jpg". */
function intrinsicSize(image: unknown): { width: number; height: number } | null {
  const a = (image as { asset?: { _ref?: string; _id?: string } } | null)?.asset;
  const m = (a?._ref ?? a?._id)?.match(/-(\d+)x(\d+)-[a-z0-9]+$/i);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

interface SanityImageProps {
  image: SanityImageSource;
  alt: string;
  className?: string;
  /** Rendered size hint for the browser, e.g. "(min-width:1024px) 240px, 50vw". */
  sizes?: string;
  /** Above-the-fold / LCP image: preloaded and fetched at high priority. */
  preload?: boolean;
  /** Fill the (position: relative) parent instead of using intrinsic size. */
  fill?: boolean;
  quality?: number;
}

export default function SanityImage({ image, alt, className, sizes, preload, fill, quality }: SanityImageProps) {
  let src: string;
  try {
    src = urlFor(image).url();
  } catch {
    return null; // malformed image reference
  }
  const size = fill ? null : intrinsicSize(image);

  if (!size) {
    // No intrinsic size known (or `fill` requested): the parent must be `relative`.
    return <Image loader={sanityLoader} src={src} alt={alt} fill sizes={sizes ?? "100vw"} quality={quality} preload={preload} className={className} />;
  }
  return (
    <Image
      loader={sanityLoader}
      src={src}
      alt={alt}
      width={size.width}
      height={size.height}
      sizes={sizes ?? "100vw"}
      quality={quality}
      preload={preload}
      className={className}
    />
  );
}

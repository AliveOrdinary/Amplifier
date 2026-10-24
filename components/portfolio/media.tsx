import type { PortfolioMedia } from "@/lib/portfolio/types";
import { cn } from "@/components/ui/primitives";

/**
 * One image or video at its own proportions. Videos without sound play on a
 * silent loop like a moving image; videos with sound get controls.
 * A starting point: restyle or replace freely.
 */
export function Media({ media, className, sizes, priority }: { media: PortfolioMedia; className?: string; sizes?: string; priority?: boolean }) {
  const ratio = media.width && media.height ? `${media.width} / ${media.height}` : undefined;

  if (media.kind === "video") {
    return (
      <video
        src={media.url}
        width={media.width ?? undefined}
        height={media.height ?? undefined}
        style={{ aspectRatio: ratio }}
        className={cn("block h-auto w-full bg-panel", className)}
        playsInline
        preload="metadata"
        {...(media.hasAudio ? { controls: true } : { autoPlay: true, muted: true, loop: true })}
        aria-label={media.alt || undefined}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={media.url}
      alt={media.alt}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      style={{ aspectRatio: ratio }}
      className={cn("block h-auto w-full bg-panel", className)}
    />
  );
}

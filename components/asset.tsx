import { cn } from "@/lib/utils"

type AssetProps = {
  src: string
  /** rendered width in px (matches the SVG root width unless scaled on purpose) */
  w: number
  h: number
  className?: string
  alt?: string
  style?: React.CSSProperties
}

/** Static Figma asset from /public/figma. Plain <img>: SVGs need no optimisation. */
export function Asset({ src, w, h, className, alt = "", style }: AssetProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={w}
      height={h}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      className={cn("block max-w-none shrink-0 select-none", className)}
      style={{ width: w, height: h, ...style }}
    />
  )
}

/** Coloured icon tile used for blocks, the workflow icon and teams. */
export function Tile({
  tone,
  size,
  radius,
  glyph,
  glyphSize,
  variant,
  className,
}: {
  tone: string
  size: number
  radius: number
  glyph: string
  glyphSize: number
  variant?: "xs" | "xxs"
  className?: string
}) {
  return (
    <span
      data-size={variant}
      className={cn("aw-tile", className)}
      style={{ width: size, height: size, borderRadius: radius, ["--aw-tone" as string]: tone }}
    >
      <Asset src={glyph} w={glyphSize} h={glyphSize} />
    </span>
  )
}

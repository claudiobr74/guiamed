import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui";

const SOURCE_SIZE = 1536;
const VISIBLE_BOUNDS = {
  x: 241,
  y: 581,
  width: 1134,
  height: 371,
} as const;

const visibleWidths = {
  sm: 150,
  md: 180,
  lg: 240,
} as const;

export function Logo({
  href,
  size = "md",
  className,
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const visibleWidth = visibleWidths[size];
  const scale = visibleWidth / VISIBLE_BOUNDS.width;
  const visibleHeight = VISIBLE_BOUNDS.height * scale;
  const sourceRenderedSize = SOURCE_SIZE * scale;

  const mark = (
    <span
      className={cn("relative block shrink-0 overflow-hidden", className)}
      style={{ width: visibleWidth, height: visibleHeight }}
    >
      <Image
        src="/brand/lizacare-logo.webp"
        alt="LizaCare — Inteligência que cuida"
        width={SOURCE_SIZE}
        height={SOURCE_SIZE}
        unoptimized
        priority={size === "lg"}
        className="absolute max-w-none"
        style={{
          width: sourceRenderedSize,
          height: sourceRenderedSize,
          left: -VISIBLE_BOUNDS.x * scale,
          top: -VISIBLE_BOUNDS.y * scale,
        }}
      />
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} className="inline-flex" aria-label="LizaCare — página inicial">
      {mark}
    </Link>
  );
}

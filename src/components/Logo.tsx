import Link from "next/link";
import { Icon } from "@/components/icons";
import { cn } from "@/components/ui";

export function Logo({
  href,
  size = "md",
  className,
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = size === "lg" ? 34 : size === "sm" ? 26 : 26;
  const icon = size === "lg" ? 18 : 14;
  const word = size === "lg" ? "text-[24px] font-extrabold" : "text-[18px] font-bold";
  const mark = (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        className="flex shrink-0 items-center justify-center rounded-md bg-[#1e5fa6]"
        style={{ width: box, height: box }}
      >
        <Icon name="logo-cross" size={icon} />
      </span>
      <span className={cn("text-[#0f172a]", word)}>GuiaMed</span>
    </span>
  );
  if (!href) return mark;
  return (
    <Link href={href} className="inline-flex">
      {mark}
    </Link>
  );
}

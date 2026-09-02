export type IconName =
  | "logo-cross"
  | "home"
  | "plus-circle"
  | "file-text"
  | "users"
  | "list"
  | "archive"
  | "file-pdf"
  | "building"
  | "stethoscope"
  | "settings"
  | "search"
  | "search-lg"
  | "bell"
  | "x-circle"
  | "close"
  | "file"
  | "check"
  | "alert-triangle"
  | "alert-circle"
  | "info"
  | "sparkle"
  | "eye"
  | "eye-off"
  | "empty-document"
  | "empty-user";

export function Icon({
  name,
  size = 16,
  className,
  alt = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <span
      className={["inline-flex shrink-0 overflow-clip", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG oficial do Figma */}
      <img
        src={`/icons/${name}.svg`}
        alt={alt}
        width={size}
        height={size}
        className="size-full max-w-none"
      />
    </span>
  );
}

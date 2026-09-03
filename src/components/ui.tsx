import { Children, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Icon, type IconName } from "@/components/icons";

export { Modal } from "@/components/Modal";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "subtle";
}) {
  const styles = {
    primary: "bg-[#1e5fa6] text-white hover:bg-[#184e89] disabled:bg-[#e2e8f0] disabled:text-[#94a3b8]",
    secondary: "bg-white text-[#475569] border border-[#e2e8f0] hover:bg-[#f8fafc]",
    danger: "bg-[#dc2626] text-white hover:bg-[#b91c1c]",
    ghost: "bg-transparent text-[#1e5fa6] hover:bg-[#eff6ff]",
    subtle: "bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition disabled:cursor-not-allowed",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-[41px] w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8]",
        props.className,
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[96px] w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#0f172a] placeholder:text-[#94a3b8]",
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-[41px] w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#0f172a]",
        props.className,
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="text-[12px] font-semibold text-[#475569]">{children}</label>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const [control, ...supportingContent] = Children.toArray(children);

  return (
    <div className="flex w-full flex-col">
      <label className="flex w-full flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[#475569]">{label}</span>
        {control}
      </label>
      {supportingContent}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-[#e2e8f0] bg-white p-5", className)}>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
}) {
  const styles = {
    neutral: "bg-[#f1f5f9] text-[#475569]",
    blue: "bg-[#eff6ff] text-[#1e5fa6]",
    green: "bg-[#dcfce7] text-[#16a34a]",
    amber: "bg-[#fef3c7] text-[#b45309]",
    red: "bg-[#fee2e2] text-[#dc2626]",
  }[tone];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", styles)}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = "empty-document",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: Extract<IconName, "empty-document" | "empty-user">;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[#e2e8f0] bg-white px-10 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-[#eff6ff]">
        <Icon name={icon} size={32} />
      </span>
      <p className="mt-6 text-[16px] font-bold text-[#0f172a]">{title}</p>
      <p className="mt-2 max-w-[300px] text-[13px] text-[#475569]">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-[#e2e8f0]">
      <button
        type="button"
        className="h-9 w-9 text-[14px] text-[#475569]"
        aria-label="Diminuir quantidade"
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        −
      </button>
      <input
        aria-label="Quantidade"
        className="h-9 w-12 border-x border-[#e2e8f0] text-center text-[13px] font-semibold"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isInteger(n) && n > 0) onChange(n);
        }}
      />
      <button
        type="button"
        className="h-9 w-9 text-[14px] text-[#475569]"
        aria-label="Aumentar quantidade"
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-[20px] font-semibold text-[#0f172a]">{title}</h1>
      {actions}
    </div>
  );
}

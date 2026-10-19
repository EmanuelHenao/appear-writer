"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export function SuggestDot({ kind = "sistema" }: { kind?: "sistema" | "ia" }) {
  return kind === "ia" ? (
    <span title="Sugerido por la IA" className="rounded-full border border-accent/50 px-1.5 text-[10px] font-semibold leading-4 text-accent">
      IA
    </span>
  ) : (
    <span title="Valor sugerido" aria-label="sugerido" className="text-suggest">
      ●
    </span>
  );
}

export function Section({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2.5 border-b border-line py-4 last:border-b-0">
      <legend className="float-left mb-2.5 w-full font-semibold">
        {title} {note ? <span className="font-normal text-muted">{note}</span> : null}
      </legend>
      <div className="clear-both flex flex-col gap-2.5">{children}</div>
    </fieldset>
  );
}

export function Check({
  id,
  checked,
  onChange,
  children,
  disabled,
  suggested,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  suggested?: boolean | "ia";
  hint?: ReactNode;
}) {
  return (
    <label htmlFor={id} className={`flex items-start gap-2.5 leading-snug ${disabled ? "opacity-45" : "cursor-pointer"}`}>
      <input id={id} type="checkbox" className="mt-0.5" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        {children} {suggested ? <SuggestDot kind={suggested === "ia" ? "ia" : "sistema"} /> : null}
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Choice({
  name,
  value,
  checked,
  onSelect,
  children,
  suggested,
  disabled,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (v: string) => void;
  children: ReactNode;
  suggested?: boolean | "ia";
  disabled?: boolean;
}) {
  const id = `${name}-${value}`;
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2 rounded-[10px] border px-3 py-2.5 transition-colors ${
        checked ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"
      } ${disabled ? "opacity-45" : "cursor-pointer"}`}
    >
      <input id={id} type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => onSelect(value)} />
      <span className="min-w-0 flex-1">{children}</span>
      {suggested ? <SuggestDot kind={suggested === "ia" ? "ia" : "sistema"} /> : null}
    </label>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger"; busy?: boolean };

export function Button({ variant = "ghost", busy, className = "", children, disabled, ...rest }: BtnProps) {
  const base = "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-accent font-semibold text-accent-ink hover:bg-[#c9bcff]"
      : variant === "danger"
        ? "border border-danger/50 text-danger hover:bg-danger/10"
        : "border border-line text-text hover:border-line-strong hover:bg-panel-2";
  return (
    <button type="button" className={`${base} ${styles} ${className}`} disabled={disabled || busy} {...rest}>
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner() {
  return <span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: ReactNode }) {
  const color = tone === "error" ? "border-danger/40 text-danger" : tone === "ok" ? "border-ok/40 text-ok" : "border-line text-muted";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed ${color}`}>
      {children}
    </p>
  );
}

export function Panel({ eyebrow, title, aside, children, className = "" }: { eyebrow: string; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-panel ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="mt-1 font-display text-lg font-bold">{title}</h2>
        </div>
        {aside}
      </div>
      <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5">{children}</div>
    </section>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-lg border border-line bg-ink px-3 text-sm text-text placeholder:text-muted/70 focus:border-accent ${props.className ?? ""}`}
    />
  );
}

/** Descarga la respuesta de un POST como archivo. */
export async function downloadFrom(url: string, body: unknown, fallbackName: string): Promise<Response> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "No se pudo generar el archivo." }));
    throw new Error(data.error ?? "No se pudo generar el archivo.");
  }
  await saveBlob(res, fallbackName);
  return res;
}

export async function saveBlob(res: Response, fallbackName: string) {
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = cd.match(/filename\*=UTF-8''([^;]+)/);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data as T;
}

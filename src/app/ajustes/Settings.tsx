"use client";

import { useState } from "react";
import { Button, Notice, postJson, TextInput } from "@/components/ui";
import { useSettings } from "@/components/useSettings";
import { detectProvider, PROVIDERS, type ProviderId } from "@/lib/ai/detect";
import { FONTS, IMAGE_FONT_CHOICES, fontStack } from "@/design/fonts";
import type { PublicSettings } from "@/lib/settings";

async function put(body: unknown): Promise<PublicSettings> {
  const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

export function SettingsPage() {
  const { settings, setSettings } = useSettings();
  if (!settings) return <main className="p-8 text-muted">Cargando ajustes…</main>;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
      <h1 className="font-display text-3xl font-bold tracking-tight">Ajustes</h1>
      <AiSection settings={settings} onSaved={setSettings} />
      <PhotosSection settings={settings} onSaved={setSettings} />
      <BrandSection settings={settings} onSaved={setSettings} />
    </main>
  );
}

function Card({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6">
      <div>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{intro}</p>
      </div>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

function AiSection({ settings, onSaved }: { settings: PublicSettings; onSaved: (s: PublicSettings) => void }) {
  const ai = settings.ai;
  const [key, setKey] = useState("");
  const [provider, setProvider] = useState<string>(ai.provider);
  const [baseUrl, setBaseUrl] = useState(ai.baseUrl);
  const [mainModel, setMainModel] = useState(ai.mainModel);
  const [fastModel, setFastModel] = useState(ai.fastModel);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const guessed = key ? detectProvider(key) : null;
  const effectiveId = (provider !== "auto" ? provider : guessed ?? ai.resolved?.provider) as ProviderId | undefined;
  const info = effectiveId ? PROVIDERS[effectiveId] : null;

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const s = await put({ ai: { ...(key ? { apiKey: key } : {}), provider, baseUrl, mainModel, fastModel } });
      onSaved(s);
      setKey("");
      setMsg({ tone: "ok", text: s.ai.resolved ? `Guardado. Proveedor: ${s.ai.resolved.label}.` : "Guardado. Falta completar la configuración." });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      onSaved(await put({ ai: { apiKey: "" } }));
      setMsg({ tone: "ok", text: "API key borrada." });
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setMsg(null);
    try {
      const r = await postJson<{ provider: string; model: string }>("/api/ai", { task: "test", tier: "fast" });
      setMsg({ tone: "ok", text: `Conexión correcta con ${r.provider} (modelo ${r.model}).` });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function loadModels() {
    setBusy("models");
    setMsg(null);
    try {
      const r = await postJson<{ models: string[] }>("/api/ai", { task: "models" });
      setModels(r.models);
      if (!r.models.length) setMsg({ tone: "error", text: "El proveedor no devolvió modelos." });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card
      id="ia"
      title="Inteligencia artificial"
      intro="Es opcional: sin key la app funciona igual y las opciones de IA quedan desactivadas. Sirve una key de Anthropic, OpenAI, Gemini, OpenRouter, Groq, xAI, DeepSeek, Mistral o cualquier servicio compatible con OpenAI (incluido un servidor local)."
    >
      <div className="rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm">
        {ai.resolved ? (
          <>
            Activa: <strong>{ai.resolved.label}</strong> · {ai.apiKeyMasked || "sin key"} {ai.fromEnv ? "(desde variables de entorno)" : ""}
            <div className="text-muted">
              Modelo principal {ai.resolved.mainModel} · rápido {ai.resolved.fastModel}
            </div>
          </>
        ) : (
          <span className="text-muted">No hay IA configurada.</span>
        )}
      </div>
      <Field
        label="API key"
        htmlFor="ai-key"
        hint={key && guessed ? `Parece de ${PROVIDERS[guessed].label}.` : "Se guarda solo en tu servidor y nunca se muestra completa."}
      >
        <TextInput id="ai-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={ai.apiKeyMasked || "sk-ant-…, sk-…, AIza…"} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Proveedor" htmlFor="ai-provider">
          <select id="ai-provider" value={provider} onChange={(e) => setProvider(e.target.value)} className="h-10 rounded-lg border border-line bg-ink px-2 text-sm">
            <option value="auto">Detectar por la key</option>
            {Object.values(PROVIDERS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="URL base" htmlFor="ai-base" hint={info?.baseUrl ? `Por defecto ${info.baseUrl}` : "Obligatoria para servicios compatibles"}>
          <TextInput id="ai-base" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={info?.baseUrl || "http://localhost:11434/v1"} />
        </Field>
        <Field label="Modelo principal" htmlFor="ai-main" hint={info?.mainModel ? `Por defecto ${info.mainModel}` : undefined}>
          <TextInput id="ai-main" list="ai-models" value={mainModel} onChange={(e) => setMainModel(e.target.value)} placeholder={info?.mainModel} />
        </Field>
        <Field label="Modelo rápido" htmlFor="ai-fast" hint={info?.fastModel ? `Por defecto ${info.fastModel}` : undefined}>
          <TextInput id="ai-fast" list="ai-models" value={fastModel} onChange={(e) => setFastModel(e.target.value)} placeholder={info?.fastModel} />
        </Field>
      </div>
      <datalist id="ai-models">
        {models.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={save} busy={busy === "save"}>
          Guardar
        </Button>
        <Button onClick={test} busy={busy === "test"} disabled={!ai.resolved}>
          Probar conexión
        </Button>
        <Button onClick={loadModels} busy={busy === "models"} disabled={!ai.resolved}>
          Ver modelos disponibles
        </Button>
        {ai.apiKeyMasked && !ai.fromEnv ? (
          <Button variant="danger" onClick={remove} busy={busy === "remove"}>
            Borrar key
          </Button>
        ) : null}
      </div>
      {models.length ? <p className="text-xs text-muted">{models.length} modelos cargados: aparecen como sugerencias en los campos de modelo.</p> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </Card>
  );
}

function PhotosSection({ settings, onSaved }: { settings: PublicSettings; onSaved: (s: PublicSettings) => void }) {
  const [unsplash, setUnsplash] = useState("");
  const [pexels, setPexels] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  async function save() {
    const s = await put({ photos: { ...(unsplash ? { unsplashKey: unsplash } : {}), ...(pexels ? { pexelsKey: pexels } : {}) } });
    onSaved(s);
    setUnsplash("");
    setPexels("");
    setMsg("Guardado.");
  }
  return (
    <Card
      id="fotos"
      title="Fotos reales"
      intro="Para fondos y páginas de libro con fotos de personas y lugares reales, que no parecen hechas con IA. Las dos keys son gratuitas: unsplash.com/developers y pexels.com/api."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Unsplash (Access Key)" htmlFor="unsplash" hint={settings.photos.unsplash ? `Configurada: ${settings.photos.unsplashMasked}` : "Sin configurar"}>
          <TextInput id="unsplash" type="password" value={unsplash} onChange={(e) => setUnsplash(e.target.value)} />
        </Field>
        <Field label="Pexels (API Key)" htmlFor="pexels" hint={settings.photos.pexels ? `Configurada: ${settings.photos.pexelsMasked}` : "Sin configurar"}>
          <TextInput id="pexels" type="password" value={pexels} onChange={(e) => setPexels(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" onClick={save} disabled={!unsplash && !pexels}>
          Guardar
        </Button>
        {settings.photos.unsplash || settings.photos.pexels ? (
          <Button
            variant="danger"
            onClick={async () => {
              onSaved(await put({ photos: { unsplashKey: "", pexelsKey: "" } }));
              setMsg("Keys borradas.");
            }}
          >
            Borrar keys
          </Button>
        ) : null}
      </div>
      {msg ? <Notice tone="ok">{msg}</Notice> : null}
    </Card>
  );
}

function BrandSection({ settings, onSaved }: { settings: PublicSettings; onSaved: (s: PublicSettings) => void }) {
  const b = settings.brand;
  const [handle, setHandle] = useState(b.handle);
  const [colors, setColors] = useState(b.colors);
  const [font, setFont] = useState(b.font);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save() {
    try {
      onSaved(await put({ brand: { handle, colors, font } }));
      setMsg({ tone: "ok", text: "Marca guardada." });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    }
  }

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/brand/logo", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) setMsg({ tone: "error", text: data.error });
    else {
      onSaved(data);
      setMsg({ tone: "ok", text: "Logo subido." });
    }
  }

  return (
    <Card id="marca" title="Marca personal" intro="Se aplica solo a las imágenes en las que marques la casilla correspondiente.">
      <Field label="Firma o usuario" htmlFor="handle">
        <TextInput id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@tuusuario" />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Logo</span>
        <div className="flex items-center gap-4">
          {b.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.logoUrl} alt="Logo actual" className="h-14 w-auto rounded bg-panel-2 p-1" />
          ) : (
            <span className="text-sm text-muted">Sin logo</span>
          )}
          <label className="cursor-pointer rounded-xl border border-line px-4 py-2 text-sm hover:border-line-strong">
            Subir PNG, JPG, WEBP o SVG
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          {b.logoUrl ? (
            <Button variant="danger" className="h-9" onClick={async () => onSaved(await put({ brand: { removeLogo: true } }))}>
              Quitar
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Paleta de marca</span>
        <div className="flex flex-wrap gap-4">
          {(["bg", "fg", "accent"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="color" value={colors[k]} onChange={(e) => setColors({ ...colors, [k]: e.target.value })} className="h-9 w-12 rounded border border-line bg-transparent" />
              {k === "bg" ? "Fondo" : k === "fg" ? "Texto" : "Acento"}
            </label>
          ))}
        </div>
      </div>
      <Field label="Fuente de marca" htmlFor="brand-font">
        <select id="brand-font" value={font} onChange={(e) => setFont(e.target.value)} className="h-10 rounded-lg border border-line bg-ink px-2 text-sm" style={{ fontFamily: fontStack(font as keyof typeof FONTS) }}>
          {IMAGE_FONT_CHOICES.map((id) => (
            <option key={id} value={id}>
              {FONTS[id].label}
            </option>
          ))}
        </select>
      </Field>
      <div className="rounded-xl p-5" style={{ background: colors.bg, color: colors.fg, fontFamily: fontStack(font as keyof typeof FONTS) }}>
        <span className="text-2xl">Así se ve tu marca</span> <span style={{ background: colors.accent, color: colors.bg }} className="px-1">destacado</span>
        <div className="mt-2 text-sm opacity-80">{handle || "@tuusuario"}</div>
      </div>
      <Button variant="primary" className="self-start" onClick={save}>
        Guardar marca
      </Button>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </Card>
  );
}

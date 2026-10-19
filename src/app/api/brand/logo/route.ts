import { errorResponse, fail } from "@/lib/http";
import { loadSettings, publicSettings, saveSettings } from "@/lib/settings";
import { dataPath, writeBinary } from "@/lib/storage";

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("Elige una imagen para el logo.");
    const ext = TYPES[file.type];
    if (!ext) return fail("El logo debe ser PNG, JPG, WEBP o SVG.");
    if (file.size > 5 * 1024 * 1024) return fail("El logo no puede pasar de 5 MB.");
    const name = `logo-${Date.now()}.${ext}`;
    await writeBinary(dataPath("brand", name), Buffer.from(await file.arrayBuffer()));
    const s = await loadSettings();
    s.brand.logoFile = name;
    await saveSettings(s);
    return Response.json(publicSettings(s));
  } catch (e) {
    return errorResponse(e);
  }
}

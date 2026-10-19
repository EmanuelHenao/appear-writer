import { errorResponse, fail } from "@/lib/http";
import { listUploads, saveUpload, uploadProblem } from "@/lib/uploads";

/** Tus fotos subidas (para fondos y aperturas de capítulo). */
export async function GET() {
  return Response.json(await listUploads());
}

/** Sube una o varias fotos («files»). Devuelve las guardadas y los avisos. */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) return fail("Elige al menos una foto.");
    if (files.length > 40) return fail("Sube como mucho 40 fotos a la vez.");
    const errors: string[] = [];
    const photos = [];
    for (const f of files) {
      const problem = uploadProblem(f);
      if (problem) errors.push(problem);
      else photos.push(await saveUpload(f));
    }
    if (!photos.length) return fail(errors.join(" "));
    return Response.json({ photos, errors });
  } catch (e) {
    return errorResponse(e);
  }
}

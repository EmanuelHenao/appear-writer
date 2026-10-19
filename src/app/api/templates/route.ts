import { NewTemplateSchema } from "@/design/saved";
import { errorResponse } from "@/lib/http";
import { addTemplate, listTemplates } from "@/lib/templates";

export async function GET() {
  return Response.json(await listTemplates());
}

/** Guarda un diseño como plantilla propia. */
export async function POST(req: Request) {
  try {
    const body = NewTemplateSchema.parse(await req.json());
    return Response.json(await addTemplate(body));
  } catch (e) {
    return errorResponse(e);
  }
}

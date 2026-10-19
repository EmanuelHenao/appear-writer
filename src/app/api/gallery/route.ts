import { listGallery } from "@/lib/gallery";

export async function GET() {
  return Response.json({ items: await listGallery() });
}

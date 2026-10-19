import { createBook, listBooks } from "@/book/project";
import { errorResponse } from "@/lib/http";

export async function GET() {
  return Response.json({ books: await listBooks() });
}

export async function POST() {
  try {
    return Response.json(await createBook());
  } catch (e) {
    return errorResponse(e);
  }
}

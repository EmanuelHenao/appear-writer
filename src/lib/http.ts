import "server-only";
import { ZodError } from "zod";
import { AiError } from "./ai/client";

export function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/** Convierte cualquier error en una respuesta JSON con un mensaje útil. */
export function errorResponse(e: unknown) {
  if (e instanceof AiError) return fail(e.message, e.status >= 400 && e.status < 600 ? e.status : 500);
  if (e instanceof ZodError) return fail("Los datos enviados no son válidos: " + e.issues.map((i) => i.path.join(".") || i.message).join(", "), 400);
  console.error(e);
  return fail(e instanceof Error ? e.message : "Error inesperado", 500);
}

export const NO_AI =
  "No hay una API key configurada. Añádela en Ajustes o desmarca las opciones de IA.";

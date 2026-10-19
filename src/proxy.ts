import { NextResponse, type NextRequest } from "next/server";

// Acceso con una sola contraseña (APP_PASSWORD). Sin contraseña definida la
// app queda abierta, pensado para uso local.
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const pass = decoded.slice(decoded.indexOf(":") + 1);
      if (timingSafeEqual(pass, password)) return NextResponse.next();
    } catch {
      // Cabecera mal formada: se pide de nuevo.
    }
  }
  return new NextResponse("Se necesita la contraseña de Appear Writer.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Appear Writer", charset="UTF-8"' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

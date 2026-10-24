import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { ZipWriter } from "./zipstream";

function build(n: number): Buffer {
  const zip = new ZipWriter();
  const parts: Buffer[] = [];
  for (let i = 0; i < n; i++) parts.push(...zip.file(`p-${i}.txt`, Buffer.from(`página ${i}`)));
  parts.push(zip.end());
  return Buffer.concat(parts);
}

describe("ZIP en streaming", () => {
  it("se lee con su contenido intacto", async () => {
    const zip = await JSZip.loadAsync(build(3));
    expect(Object.keys(zip.files)).toEqual(["p-0.txt", "p-1.txt", "p-2.txt"]);
    expect(await zip.file("p-2.txt")!.async("string")).toBe("página 2");
  });

  it("con más de 65 535 archivos usa ZIP64", async () => {
    const data = build(70_000);
    const zip = await JSZip.loadAsync(data);
    expect(Object.keys(zip.files)).toHaveLength(70_000);
    expect(await zip.file("p-69999.txt")!.async("string")).toBe("página 69999");
    // Si hay `unzip` en el sistema, también lo valida.
    try {
      const file = path.join(mkdtempSync(path.join(tmpdir(), "zip-")), "big.zip");
      writeFileSync(file, data);
      expect(execFileSync("unzip", ["-tq", file], { encoding: "utf8" })).toMatch(/No errors/);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }, 60_000);
});

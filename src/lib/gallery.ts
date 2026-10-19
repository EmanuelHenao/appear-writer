import "server-only";
import { composeSlides } from "@/design/compose";
import type { ImageRequest } from "@/design/request";
import { renderSlidesPng } from "./render/image";
import { brandAssets, loadSettings } from "./settings";
import { dataPath, isSafeId, listDirs, newId, readJson, removeDir, writeBinary, writeJson } from "./storage";

export interface GalleryItem {
  id: string;
  createdAt: string;
  text: string;
  files: string[];
  width: number;
  height: number;
  request: ImageRequest;
}

export async function renderRequest(req: ImageRequest) {
  const settings = await loadSettings();
  const slides = composeSlides({
    text: req.text,
    options: req.options,
    design: req.design,
    sizeScale: req.sizeScale,
    emphasis: req.emphasis,
    label: req.label,
    photo: req.photo,
    brand: brandAssets(settings),
  });
  const pngs = await renderSlidesPng(slides, req.options.hiRes);
  const scale = req.options.hiRes ? 2 : 1;
  return { pngs, width: slides[0].width * scale, height: slides[0].height * scale };
}

export async function saveToGallery(req: ImageRequest, pngs: Buffer[], size: { width: number; height: number }): Promise<GalleryItem> {
  const id = newId();
  const files = pngs.map((_, i) => `imagen-${i + 1}.png`);
  await Promise.all(pngs.map((png, i) => writeBinary(dataPath("gallery", id, files[i]), png)));
  const item: GalleryItem = { id, createdAt: new Date().toISOString(), text: req.text, files, ...size, request: req };
  await writeJson(dataPath("gallery", id, "meta.json"), item);
  return item;
}

export async function listGallery(): Promise<GalleryItem[]> {
  const ids = await listDirs(dataPath("gallery"));
  const items = await Promise.all(ids.filter(isSafeId).map((id) => readJson<GalleryItem | null>(dataPath("gallery", id, "meta.json"), null)));
  return items.filter((i): i is GalleryItem => !!i).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getGalleryItem(id: string): Promise<GalleryItem | null> {
  if (!isSafeId(id)) return null;
  return readJson<GalleryItem | null>(dataPath("gallery", id, "meta.json"), null);
}

export async function deleteGalleryItem(id: string): Promise<boolean> {
  if (!isSafeId(id)) return false;
  await removeDir(dataPath("gallery", id));
  return true;
}

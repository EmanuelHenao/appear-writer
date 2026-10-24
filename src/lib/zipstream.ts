import "server-only";
import { crc32 } from "node:zlib";

// ZIP que se escribe a medida que llegan los archivos, sin guardarlos todos
// en memoria. Sin compresión (los PNG ya vienen comprimidos) y con ZIP64
// cuando hace falta: más de 65 535 archivos o más de 4 GB.

const MAX16 = 0xffff;
const MAX32 = 0xffffffff;

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

interface Entry {
  name: Buffer;
  crc: number;
  size: number;
  offset: number;
}

export class ZipWriter {
  private entries: Entry[] = [];
  private offset = 0;
  private readonly stamp = dosDateTime(new Date());

  /** Cabecera y datos de un archivo, listos para enviar. */
  file(name: string, data: Buffer | Uint8Array): Buffer[] {
    const n = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(45, 4);
    h.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    h.writeUInt16LE(0, 8); // sin compresión
    h.writeUInt16LE(this.stamp.time, 10);
    h.writeUInt16LE(this.stamp.date, 12);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(n.length, 26);
    h.writeUInt16LE(0, 28);
    this.entries.push({ name: n, crc, size: data.length, offset: this.offset });
    this.offset += h.length + n.length + data.length;
    return [h, n, Buffer.from(data.buffer, data.byteOffset, data.length)];
  }

  /** El directorio central y el final del ZIP. */
  end(): Buffer {
    const parts: Buffer[] = [];
    const cdStart = this.offset;
    let cdSize = 0;
    for (const e of this.entries) {
      const big = e.offset > MAX32;
      const extra = big ? Buffer.alloc(12) : Buffer.alloc(0);
      if (big) {
        extra.writeUInt16LE(0x0001, 0);
        extra.writeUInt16LE(8, 2);
        extra.writeBigUInt64LE(BigInt(e.offset), 4);
      }
      const h = Buffer.alloc(46);
      h.writeUInt32LE(0x02014b50, 0);
      h.writeUInt16LE(45, 4);
      h.writeUInt16LE(45, 6);
      h.writeUInt16LE(0x0800, 8);
      h.writeUInt16LE(0, 10);
      h.writeUInt16LE(this.stamp.time, 12);
      h.writeUInt16LE(this.stamp.date, 14);
      h.writeUInt32LE(e.crc, 16);
      h.writeUInt32LE(e.size, 20);
      h.writeUInt32LE(e.size, 24);
      h.writeUInt16LE(e.name.length, 28);
      h.writeUInt16LE(extra.length, 30);
      h.writeUInt32LE(big ? MAX32 : e.offset, 42);
      parts.push(h, e.name, extra);
      cdSize += h.length + e.name.length + extra.length;
    }
    const count = this.entries.length;
    if (count > MAX16 || cdStart > MAX32 || cdSize > MAX32) {
      const z = Buffer.alloc(56);
      z.writeUInt32LE(0x06064b50, 0);
      z.writeBigUInt64LE(BigInt(44), 4);
      z.writeUInt16LE(45, 12);
      z.writeUInt16LE(45, 14);
      z.writeBigUInt64LE(BigInt(count), 24);
      z.writeBigUInt64LE(BigInt(count), 32);
      z.writeBigUInt64LE(BigInt(cdSize), 40);
      z.writeBigUInt64LE(BigInt(cdStart), 48);
      const loc = Buffer.alloc(20);
      loc.writeUInt32LE(0x07064b50, 0);
      loc.writeBigUInt64LE(BigInt(cdStart + cdSize), 8);
      loc.writeUInt32LE(1, 16);
      parts.push(z, loc);
    }
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(Math.min(count, MAX16), 8);
    eocd.writeUInt16LE(Math.min(count, MAX16), 10);
    eocd.writeUInt32LE(Math.min(cdSize, MAX32), 12);
    eocd.writeUInt32LE(Math.min(cdStart, MAX32), 16);
    parts.push(eocd);
    return Buffer.concat(parts);
  }
}

type ZipInput = { name: string; data: Uint8Array };
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const table = (() => { const result = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; result[n] = c >>> 0; } return result; })();
const crc32 = (bytes: Uint8Array) => { let crc = 0xffffffff; for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; };
const write16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true);
const write32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value, true);

export const createZip = (files: ZipInput[]) => {
  const localParts: Uint8Array[] = []; const centralParts: Uint8Array[] = []; let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name); const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length + file.data.length); const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50); write16(localView, 4, 20); write16(localView, 8, 0); write32(localView, 14, crc); write32(localView, 18, file.data.length); write32(localView, 22, file.data.length); write16(localView, 26, name.length); local.set(name, 30); local.set(file.data, 30 + name.length); localParts.push(local);
    const central = new Uint8Array(46 + name.length); const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50); write16(centralView, 4, 20); write16(centralView, 6, 20); write16(centralView, 10, 0); write32(centralView, 16, crc); write32(centralView, 20, file.data.length); write32(centralView, 24, file.data.length); write16(centralView, 28, name.length); write32(centralView, 42, offset); central.set(name, 46); centralParts.push(central); offset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0); const end = new Uint8Array(22); const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50); write16(endView, 8, files.length); write16(endView, 10, files.length); write32(endView, 12, centralSize); write32(endView, 16, offset);
  return new Blob([...localParts, ...centralParts, end].map(part => part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer), { type: "application/zip" });
};

const inflate = async (data: Uint8Array) => {
  const stream = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

export const readZip = async (input: ArrayBuffer) => {
  const bytes = new Uint8Array(input); const view = new DataView(input); const result = new Map<string, Uint8Array>(); let offset = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const flags = view.getUint16(offset + 6, true); const method = view.getUint16(offset + 8, true); const size = view.getUint32(offset + 18, true); const nameLength = view.getUint16(offset + 26, true); const extraLength = view.getUint16(offset + 28, true);
    if (flags & 8) throw new Error("ZIP data descriptors are not supported");
    const name = decoder.decode(bytes.slice(offset + 30, offset + 30 + nameLength)); const start = offset + 30 + nameLength + extraLength; const packed = bytes.slice(start, start + size);
    result.set(name, method === 0 ? packed : method === 8 ? await inflate(packed) : (() => { throw new Error("Unsupported ZIP compression"); })());
    offset = start + size;
  }
  return result;
};

export const textBytes = (value: string) => encoder.encode(value);
export const bytesText = (value: Uint8Array) => decoder.decode(value);

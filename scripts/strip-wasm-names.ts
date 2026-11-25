import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const WASM_HEADER = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

function readU32(bytes: Buffer, offset: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  let next = offset;
  for (let i = 0; i < 5; i += 1) {
    if (next >= bytes.length) throw new Error('LEB128 truncado');
    const byte = bytes[next];
    next += 1;
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return { value, next };
    shift += 7;
  }
  throw new Error('LEB128 de cinco bytes no terminado');
}

function customSectionName(payload: Buffer): string | null {
  if (payload.length === 0) return null;
  const length = readU32(payload, 0);
  const start = length.next;
  const end = start + length.value;
  if (end > payload.length) return null;
  return payload.subarray(start, end).toString('utf8');
}

/** Elimina únicamente la custom section `name`; conserva el resto del módulo. */
export function stripWasmNames(input: Buffer): { output: Buffer; removed: number } {
  if (!input.subarray(0, 8).equals(WASM_HEADER)) throw new Error('No es un módulo WebAssembly válido');

  const chunks: Buffer[] = [input.subarray(0, 8)];
  let offset = 8;
  let removed = 0;

  while (offset < input.length) {
    const start = offset;
    const id = input[offset];
    offset += 1;
    const size = readU32(input, offset);
    offset = size.next;
    const end = offset + size.value;
    if (end > input.length) throw new Error('Sección WebAssembly truncada');

    const payload = input.subarray(offset, end);
    if (id === 0 && customSectionName(payload) === 'name') {
      removed += 1;
    } else {
      chunks.push(input.subarray(start, end));
    }
    offset = end;
  }

  return { output: Buffer.concat(chunks), removed };
}

if (process.argv[1] && basename(process.argv[1]) === basename(import.meta.filename)) {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    console.error('Uso: node scripts/strip-wasm-names.mts <input.wasm> <output.wasm>');
    process.exit(2);
  }
  const input = readFileSync(inputPath);
  const { output, removed } = stripWasmNames(input);
  writeFileSync(outputPath, output);
  console.log(JSON.stringify({ input: inputPath, output: outputPath, before: input.length, after: output.length, removed }));
}

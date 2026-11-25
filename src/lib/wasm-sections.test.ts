import { describe, expect, it } from 'vitest';
import { stripWasmNames } from '../../scripts/strip-wasm-names';

const header = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

function u32(value: number): Buffer {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value = Math.floor(value / 128);
    if (value) byte |= 0x80;
    bytes.push(byte);
  } while (value);
  return Buffer.from(bytes);
}

function section(id: number, payload: Buffer): Buffer {
  return Buffer.concat([Buffer.from([id]), u32(payload.length), payload]);
}

function custom(name: string, payload = Buffer.alloc(0)): Buffer {
  const nameBytes = Buffer.from(name);
  return section(0, Buffer.concat([u32(nameBytes.length), nameBytes, payload]));
}

describe('stripWasmNames', () => {
  it('elimina solo la sección name y conserva el resto del módulo', () => {
    const name = custom('name', Buffer.from('datos de nombres'));
    const producers = custom('producers', Buffer.from('datos de productor'));
    const code = section(10, Buffer.from([0x00]));
    const input = Buffer.concat([header, name, producers, code]);

    const result = stripWasmNames(input);

    expect(result.removed).toBe(1);
    expect(result.output.equals(Buffer.concat([header, producers, code]))).toBe(true);
  });

  it('rechaza archivos que no sean WebAssembly', () => {
    expect(() => stripWasmNames(Buffer.from('no wasm'))).toThrow(/WebAssembly/);
  });
});

import { assert } from "./utils.ts";

export class Packet {
  #ab: ArrayBuffer;
  #dv: DataView;
  #readIndex = 0;
  #writeIndex = 0;
  constructor(public size: number) {
    this.#ab = new ArrayBuffer(size);
    this.#dv = new DataView(this.#ab);
  }
  readInt32() {
    const n = this.#dv.getInt32(this.#readIndex);
    this.#readIndex += 4;
    return n;
  }
  writeInt32(n: number) {
    assert(n >= -2147483648 && n <= 2147483647);
    this.#dv.setInt32(this.#writeIndex, n);
    this.#writeIndex += 4;
    return this;
  }
  readUint32() {
    const n = this.#dv.getUint32(this.#readIndex);
    this.#readIndex += 4;
    return n;
  }
  writeUint32(n: number) {
    assert(n >= 0 && n <= 4294967295);
    this.#dv.setUint32(this.#writeIndex, n);
    this.#writeIndex += 4;
    return this;
  }
  readUint16() {
    const n = this.#dv.getUint16(this.#readIndex);
    this.#readIndex += 2;
    return n;
  }
  writeUint16(n: number) {
    assert(n >= 0 && n <= 65535);
    this.#dv.setUint16(this.#writeIndex, n);
    this.#writeIndex += 2;
    return this;
  }
  readUint8() {
    const n = this.#dv.getUint8(this.#readIndex);
    this.#readIndex += 1;
    return n;
  }
  writeUint8(n: number) {
    assert(n >= 0 && n <= 255);
    this.#dv.setUint8(this.#writeIndex, n);
    this.#writeIndex += 1;
    return this;
  }
  readIP() {
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(this.#dv.getUint8(this.#readIndex + i));
    }
    this.#readIndex += 4;
    return segments.join(".");
  }
  writeIP(ip: string) {
    const segments = ip.split(".").map((n) => Number(n));
    for (const segment of segments) {
      this.writeUint8(segment);
    }
    return this;
  }
  reset() {
    this.#readIndex = 0;
    this.#writeIndex = 0;
    return this;
  }
  output() {
    assert(this.#writeIndex === this.size);
    return new Uint8Array(this.#ab);
  }
  static from(buf: Uint8Array) {
    const p = new Packet(buf.byteLength);
    p.#ab = buf.buffer;
    p.#dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return p;
  }
}

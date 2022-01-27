import { readAll, type TaggedPacket, writeAll } from "./utils.ts";

import { Packet } from "./packet.ts";

export class Protocol {
  constructor(public conn: Deno.Conn) {}
  async readInitPacket() {
    const buf = new Uint8Array(new ArrayBuffer(10));
    const result = await readAll(this.conn, buf);
    if (result === null) {
      return null;
    }
    const p = Packet.from(buf.subarray(0, result));
    const secret = p.readUint32();
    const port = p.readUint16();
    const ip = p.readIP();
    return { secret, port, ip };
  }
  async writeInitPacket(secret: number, port: number, ip: string) {
    const p = new Packet(10);
    p.writeUint32(secret);
    p.writeUint16(port);
    p.writeIP(ip);
    const buf = p.output();
    await writeAll(this.conn, buf);
  }
  async readInitPacketResponse() {
    const buf = new Uint8Array(new ArrayBuffer(4));
    const result = await readAll(this.conn, buf);
    if (result === null) {
      return -1;
    }
    const p = Packet.from(buf.subarray(0, result));
    const idx = p.readInt32();
    return idx;
  }
  async writeInitPacketResponse(idx: number) {
    const p = new Packet(4);
    p.writeInt32(idx);
    const buf = p.output();
    await writeAll(this.conn, buf);
  }
  async readVarPacket() {
    const sizeBuf = new Uint8Array(new ArrayBuffer(2));
    const sizeResult = await readAll(this.conn, sizeBuf);
    if (sizeResult === null) {
      return null;
    }
    const size = Packet.from(sizeBuf.subarray(0, sizeResult)).readUint16();
    const buf = new Uint8Array(new ArrayBuffer(size));
    const result = await readAll(this.conn, buf);
    if (result === null) {
      return null;
    }
    return buf.subarray(0, result);
  }
  async writeVarPacket(buf: Uint8Array) {
    await writeAll(
      this.conn,
      new Packet(2).writeUint16(buf.byteLength).output(),
    );
    await writeAll(this.conn, buf);
  }
  async readTunnelPacket() {
    const buf = await this.readVarPacket();
    if (buf === null) {
      return null;
    }
    const p = Packet.from(buf);
    const connID = p.readUint32();
    const data = buf.subarray(4);
    return { connID, data };
  }
  async writeTunnelPacket(connID: number, buf: Uint8Array) {
    await writeAll(
      this.conn,
      new Packet(2).writeUint16(4 + buf.byteLength).output(),
    );
    await writeAll(this.conn, new Packet(4).writeUint32(connID).output());
    await writeAll(this.conn, buf);
  }
}

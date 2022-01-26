import { Packet } from "./packet.ts";
import { writeAll } from "./utils.ts";
import { Protocol } from "./protocol.ts";

const servers = [];

const bufSize = 65535;

for await (const conn of Deno.listen({ port: 4000 })) {
  (async () => {
    const p = new Protocol(conn);
    const result = await p.readInitPacket();
    if (result === null) {
      return conn.close();
    }
    const { secret, port, ip } = result;
    if (secret !== 1337) {
      await p.writeInitPacketResponse(-1);
      return conn.close();
    }
    try {
      const listener = Deno.listen({ port, hostname: ip });
      const index = servers.push(listener) - 1;
      await p.writeInitPacketResponse(index);
      const subconns = [];
      for await (const subconn of listener) {
        const idx = subconns.push(subconn);
        (async () => {
          const buf = new Uint8Array(bufSize);
          while (true) {
            const result = await subconn.read(buf);
            if (result === null) {
              subconns.splice(subconns.indexOf(subconn), 1);
              return subconn.close();
            }
            await p.writeTunnelPacket(idx, buf.subarray(0, result));
          }
        })().catch((err) => console.error("[subconn loop]: " + err.message));
      }
    } catch (err) {
      await p.writeInitPacketResponse(-1);
    }
  })().catch((err) => console.error("[main loop]: " + err.message));
}

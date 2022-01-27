import { parseArgs, sleep, type TaggedPacket, writeAll } from "./utils.ts";
import { Protocol } from "./protocol.ts";

const servers = [];
const args = parseArgs(Deno.args);
const defaults = {
  listen: {
    port: 2000,
    ip: "127.0.0.1",
  },
  bufSize: 65531,
  secret: 1337,
};
const opts = {
  ...defaults,
  ...args,
  listen: {
    ...defaults.listen,
    ...typeof args.listen === "object" ? args.listen : {},
  },
};

console.log(Deno.inspect(opts, { colors: !Deno.noColor, compact: false }));

for await (
  const conn of Deno.listen({
    port: opts.listen.port,
    hostname: opts.listen.ip,
  })
) {
  (async () => {
    const p = new Protocol(conn);
    const tunnelWriteQueue: TaggedPacket[] = [];

    let subconnIndex = 0;

    const result = await p.readInitPacket();
    if (result === null) {
      return conn.close();
    }
    const { secret, port, ip } = result;
    if (secret !== 1337) {
      await p.writeInitPacketResponse(-1);
      return conn.close();
    }
    (async () => {
      while (true) {
        const packet = tunnelWriteQueue.shift();
        if (packet) {
          await p.writeTunnelPacket(packet.id, packet.data);
        } else {
          await sleep(1);
        }
      }
    })().catch((err) => console.error("[tunnel write queue]: ", err));
    try {
      const listener = Deno.listen({ port, hostname: ip });
      const index = servers.push(listener) - 1;
      await p.writeInitPacketResponse(index);
      const subconns: Record<number, Deno.Conn> = {};
      (async () => {
        while (true) {
          const result = await p.readTunnelPacket().catch(() => null);
          if (result === null) {
            servers.splice(servers.indexOf(listener), 1);
            listener.close();
            return conn.close();
          }
          const subconn = subconns[result.connID];
          if (subconn) {
            await writeAll(subconn, result.data);
          }
        }
      })().catch((err) => console.error("[tunnel read loop]: ", err));
      for await (const subconn of listener) {
        const idx = subconnIndex++;
        subconns[idx] = subconn;
        (async () => {
          while (true) {
            const buf = new Uint8Array(opts.bufSize);
            const result = await subconn.read(buf);
            if (result === null) {
              delete subconns[idx];
              return subconn.close();
            }
            tunnelWriteQueue.push({
              id: idx,
              data: buf.subarray(0, result),
            });
          }
        })().catch((err) => console.error("[subconn read loop]: ", err));
      }
    } catch (err) {
      await p.writeInitPacketResponse(-1);
    }
  })().catch((err) => console.error("[main loop]: ", err));
}

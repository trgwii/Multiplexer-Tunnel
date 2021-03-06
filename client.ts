import { Protocol } from "./protocol.ts";
import { parseArgs, sleep, type TaggedPacket, writeAll } from "./utils.ts";

const args = parseArgs(Deno.args);

const defaults = {
  server: {
    port: 2000,
    ip: "127.0.0.1",
  },
  listen: {
    port: 8080,
    ip: "127.0.0.1",
  },
  connect: {
    port: 4507,
    ip: "127.0.0.1",
  },
  secret: 1337,
  bufSize: 65531,
};

const opts = {
  ...defaults,
  ...args,
  server: {
    ...defaults.server,
    ...typeof args.server === "object" ? args.server : {},
  },
  listen: {
    ...defaults.listen,
    ...typeof args.listen === "object" ? args.listen : {},
  },
  connect: {
    ...defaults.connect,
    ...typeof args.connect === "object" ? args.connect : {},
  },
};

console.log(Deno.inspect(opts, { colors: !Deno.noColor, compact: false }));

const conn = await Deno.connect({
  port: opts.server.port,
  hostname: opts.server.ip,
});

const p = new Protocol(conn);

await p.writeInitPacket(opts.secret, opts.listen.port, opts.listen.ip);
const idx = await p.readInitPacketResponse();

if (idx === -1) {
  console.error("Couldn't create tunnel");
  Deno.exit(1);
}

const connections: Record<number, Deno.Conn> = {};

const tunnelWriteQueue: TaggedPacket[] = [];

(async () => {
  while (true) {
    const result = tunnelWriteQueue.shift();
    if (result) {
      await p.writeTunnelPacket(result.id, result.data);
    } else {
      await sleep(1);
    }
  }
})().catch((err) => console.error("[tunnel write loop]: ", err));
(async () => {
  while (true) {
    const result = await p.readTunnelPacket().catch(() => null);
    if (result === null) {
      console.error("Lost connection to tunnel");
      Deno.exit(1);
    }
    const idx = result.connID;
    if (!(result.connID in connections)) {
      connections[idx] = await Deno.connect({
        port: opts.connect.port,
        hostname: opts.connect.ip,
      });
    }
    const subconn = connections[idx];
    (async () => {
      while (true) {
        const buf = new Uint8Array(opts.bufSize);
        const result = await subconn.read(buf);
        if (result === null) {
          delete connections[idx];
          return subconn.close();
        }
        tunnelWriteQueue.push({ id: idx, data: buf.subarray(0, result) });
      }
    })().catch((err) => console.error("[subconn read loop]: ", err));
    await writeAll(subconn, result.data).catch((err) => {
      console.error("[subconn write]: ", err);
      delete connections[idx];
      return subconn.close();
    });
  }
})().catch((err) => console.error("[subconn write loop]: ", err));

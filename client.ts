import { Protocol } from "./protocol.ts";
import { writeAll } from "./utils.ts";

const [listenPort, listenIP, connectPort, connectIP] = Deno.args;

const conn = await Deno.connect({
  port: Number(listenPort),
  hostname: listenIP,
});

const p = new Protocol(conn);

await p.writeInitPacket(1337, 8080, "127.0.0.1");
const idx = await p.readInitPacketResponse();

if (idx === -1) {
  console.error("Couldn't create tunnel");
  Deno.exit(1);
}

const connections: Record<number, Deno.Conn> = {};

while (true) {
  const result = await p.readTunnelPacket();
  if (result === null) {
    console.error("Lost connection to tunnel");
    Deno.exit(1);
  }
  const idx = result.connID;
  if (!(result.connID in connections)) {
    connections[idx] = await Deno.connect({
      port: Number(connectPort),
      hostname: connectIP,
    });
  }
  const subconn = connections[idx];
  writeAll(subconn, result.data).catch((err) => {
    console.error("[subconn write]: " + err.message);
    delete connections[idx];
    return subconn.close();
  });
}

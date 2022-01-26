import { writeAll } from "./utils.ts";

const [port, hostname, text] = Deno.args;

for (let i = 0; i < 4; i++) {
  const conn = await Deno.connect({ port: Number(port), hostname: hostname });

  await writeAll(conn, new TextEncoder().encode(text));
}

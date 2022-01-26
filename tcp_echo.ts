import { copy, readAll, writeAll } from "./utils.ts";

const listener = Deno.listen({ port: 8081 });

for await (const conn of listener) {
  copy(conn, Deno.stdout);
}

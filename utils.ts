export const assert = (ok: boolean) => {
  if (!ok) {
    throw new Error("Assertion failed!");
  }
};

export const readAll = async (r: Deno.Reader, buf: Uint8Array) => {
  let bytesRead = 0;
  while (bytesRead < buf.byteLength) {
    const result = await r.read(buf.subarray(bytesRead));
    if (result === null) {
      return bytesRead > 0 ? bytesRead : null;
    }
    bytesRead += result;
  }
  return bytesRead;
};

export const writeAll = async (w: Deno.Writer, buf: Uint8Array) => {
  let bytesWritten = 0;
  while (bytesWritten < buf.byteLength) {
    bytesWritten += await w.write(buf.subarray(bytesWritten));
  }
  return bytesWritten;
};

export const copy = async (r: Deno.Reader, w: Deno.Writer) => {
  const buf = new Uint8Array(65535);
  while (true) {
    const result = await r.read(buf);
    if (result === null) {
      return;
    }
    await w.write(buf.subarray(0, result));
  }
};

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type Args = { [K: string]: string | number | Args };

export const parseArgs = (args: string[]) => {
  const result: Args = {};
  for (const arg of args) {
    const [k, v] = arg.split("=");
    const keys = k.split(".");
    let cur: Args = result;
    for (const key of keys.slice(0, -1)) {
      cur[key] = cur[key] ?? {};
      cur = cur[key] as Args;
    }
    cur[keys[keys.length - 1]] = [...v].every((c) => "0123456789".includes(c))
      ? Number(v)
      : v;
  }
  return result;
};

export type TaggedPacket = {
  id: number;
  data: Uint8Array;
};

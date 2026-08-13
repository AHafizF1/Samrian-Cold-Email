import { lookup as nodeLookup } from "node:dns/promises";
import { BlockList, isIP, isIPv4 } from "node:net";
import { domainToASCII } from "node:url";

type Address = { address: string; family: number };
type Lookup = (host: string) => Promise<Address[]>;

export type OutboundHost = {
  address: string;
  servername: string;
};

const blockedV4 = new BlockList();
const blockedV6 = new BlockList();

for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedV4.addSubnet(address, prefix, "ipv4");
}

for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedV6.addSubnet(address, prefix, "ipv6");
}

export async function resolveOutboundHost(
  input: string,
  options: {
    allowPrivate?: boolean;
    lookup?: Lookup;
    timeoutMs?: number;
    maxAddresses?: number;
  } = {}
): Promise<OutboundHost> {
  const servername = normalizeHost(input);
  const directFamily = isIP(servername);
  const addresses = directFamily
    ? [{ address: servername, family: directFamily }]
    : await withTimeout(
        (options.lookup ?? defaultLookup)(servername),
        options.timeoutMs ?? 5_000,
        "DNS lookup timed out"
      );

  if (addresses.length === 0 || addresses.length > (options.maxAddresses ?? 16)) {
    throw new Error("Outbound host returned an invalid number of addresses");
  }

  const normalized = addresses.map((item) => {
    const address = normalizeAddress(item.address);
    return { address, family: isIP(address) as 4 | 6 };
  });
  if (normalized.some((item) => !item.family)) {
    throw new Error("Outbound host resolved to an invalid address");
  }
  if (!options.allowPrivate && normalized.some((item) => isBlocked(item.address, item.family))) {
    throw new Error("Outbound host must resolve only to public addresses");
  }

  const selected = normalized[0];
  if (!selected) {
    throw new Error("Outbound host returned no addresses");
  }
  return { address: selected.address, servername };
}

function normalizeHost(input: string): string {
  const value = input.trim();
  if (
    !value ||
    value.length > 253 ||
    value.includes("/") ||
    value.includes("@") ||
    value.includes("%") ||
    value.includes("?") ||
    value.includes("#") ||
    value.includes("[") ||
    value.includes("]")
  ) {
    throw new Error("Invalid outbound host");
  }

  if (isIP(value)) return normalizeAddress(value);
  if (/^[0-9.]+$/.test(value) || value.includes(":")) {
    throw new Error("Invalid outbound host");
  }

  const ascii = domainToASCII(value.replace(/\.$/, "")).toLowerCase();
  if (
    !ascii ||
    ascii.length > 253 ||
    !ascii.includes(".") ||
    ascii.split(".").some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  ) {
    throw new Error("Invalid outbound host");
  }
  return ascii;
}

function normalizeAddress(address: string): string {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  return mapped && isIPv4(mapped) ? mapped : address.toLowerCase();
}

function isBlocked(address: string, family: 4 | 6): boolean {
  return family === 4 ? blockedV4.check(address, "ipv4") : blockedV6.check(address, "ipv6");
}

async function defaultLookup(host: string): Promise<Address[]> {
  return nodeLookup(host, { all: true, order: "verbatim" });
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

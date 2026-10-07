/* ipv4.js — IPv4 address math shared by the subnet calculator and the PBQ grader.
   Addresses are unsigned 32-bit integers; every result goes through >>> 0. */

export function parseIp(str) {
  const parts = String(str).trim().split('.');
  if (parts.length !== 4 || parts.some(p => !/^\d{1,3}$/.test(p) || +p > 255)) return null;
  return parts.reduce((n, p) => ((n << 8) | +p) >>> 0, 0);
}

export const fmtIp = n => [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.');

export const maskOf = prefix => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);

/* "/26", "26" or "255.255.255.192" → 26; a non-contiguous mask is null. */
export function parsePrefix(str) {
  const s = String(str).trim().replace(/^\//, '');
  if (/^\d{1,2}$/.test(s)) return +s <= 32 ? +s : null;
  const m = parseIp(s);
  if (m === null) return null;
  const prefix = 32 - Math.log2(((~m) >>> 0) + 1);
  return Number.isInteger(prefix) && maskOf(prefix) === m ? prefix : null;
}

/* "192.168.1.0/24" → { ip, prefix }, or null. */
export function parseCidr(str) {
  const [ip, prefix] = String(str).split('/');
  const a = parseIp(ip), p = prefix === undefined ? null : parsePrefix(prefix);
  return a === null || p === null ? null : { ip: a, prefix: p };
}

export function subnet(ip, prefix) {
  const mask = maskOf(prefix);
  const network = (ip & mask) >>> 0;
  const broadcast = (network | ~mask) >>> 0;
  const total = 2 ** (32 - prefix);
  /* /31 point-to-point links (RFC 3021) use both addresses; /32 is a single host. */
  const usable = prefix >= 31 ? total : total - 2;
  return {
    network, broadcast, mask, prefix, total, usable,
    wildcard: (~mask) >>> 0,
    first: prefix >= 31 ? network : network + 1,
    last: prefix >= 31 ? broadcast : broadcast - 1,
  };
}

/* The smallest prefix whose subnet holds `hosts` usable addresses. */
export function prefixFor(hosts) {
  for (let p = 30; p >= 0; p--) if (2 ** (32 - p) - 2 >= hosts) return p;
  return null;
}

export function classify(ip) {
  const o = ip >>> 24, o2 = (ip >>> 16) & 255;
  const cls = o < 128 ? 'A' : o < 192 ? 'B' : o < 224 ? 'C' : o < 240 ? 'D (multicast)' : 'E (reserved)';
  let scope = 'Public';
  if (o === 10 || (o === 172 && o2 >= 16 && o2 <= 31) || (o === 192 && o2 === 168)) scope = 'Private (RFC 1918)';
  else if (o === 127) scope = 'Loopback';
  else if (o === 169 && o2 === 254) scope = 'APIPA / link-local';
  else if (o === 100 && o2 >= 64 && o2 <= 127) scope = 'Carrier-grade NAT (RFC 6598)';
  else if (o >= 224 && o < 240) scope = 'Multicast';
  else if (o >= 240) scope = 'Reserved';
  return { cls, scope };
}

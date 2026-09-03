import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function isPublicIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIpv6(address) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  const mappedIpv4 = normalized.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isPublicIpv4(mappedIpv4);
  // Public global-unicast IPv6 addresses are currently within 2000::/3.
  if (!/^[23][0-9a-f]{3}:/i.test(normalized)) return false;
  if (/^2001:db8:/i.test(normalized)) return false;
  return true;
}

export function isPublicAddress(address) {
  const version = isIP(address.replace(/^\[|\]$/g, ''));
  if (version === 4) return isPublicIpv4(address);
  if (version === 6) return isPublicIpv6(address);
  return false;
}

export async function assertPublicHttpsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Only HTTPS URLs are allowed');
  if (url.username || url.password) throw new Error('Credentials in URLs are not allowed');
  if (url.port && url.port !== '443') throw new Error('Non-standard HTTPS ports are not allowed');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')
    || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan')) {
    throw new Error('Local network hostnames are not allowed');
  }
  if (isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw new Error('Private or reserved IP addresses are not allowed');
    return url;
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Hostname resolves to a private or reserved address');
  }
  return url;
}

export function hasSameHostname(left, right) {
  const normalizedHost = (value) => new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  return normalizedHost(left) === normalizedHost(right);
}

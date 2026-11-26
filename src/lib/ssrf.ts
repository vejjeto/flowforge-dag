import dns from "node:dns/promises";
import net from "node:net";

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const num = Number(part);
    if (num < 0 || num > 255) return null;
    value = (value << 8) | num;
  }
  return value >>> 0;
}

function isBlockedIpv4(ip: string): boolean {
  const num = ipv4ToInt(ip);
  if (num === null) return true;
  const first = (num >>> 24) & 0xff;
  const second = (num >>> 16) & 0xff;

  if (first === 0) return true; // 0.0.0.0/8
  if (first === 10) return true; // 10.0.0.0/8
  if (first === 127) return true; // 127.0.0.0/8 loopback
  if (first === 169 && second === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (first === 172 && second >= 16 && second <= 31) return true; // 172.16.0.0/12
  if (first === 192 && second === 168) return true; // 192.168.0.0/16
  if (first === 100 && second >= 64 && second <= 127) return true; // 100.64.0.0/10 CGNAT
  if (first >= 224) return true; // multicast & reserved
  return false;
}

/**
 * Checks whether an IPv4 or IPv6 address belongs to a private, loopback,
 * link-local, or reserved range that must be blocked for outbound SSRF safety.
 */
export function isBlockedIpAddress(ip: string): boolean {
  const trimmed = ip.trim().replace(/^\[|\]$/g, "");
  const version = net.isIP(trimmed);
  if (version === 4) return isBlockedIpv4(trimmed);
  if (version !== 6) return true;

  const lower = trimmed.toLowerCase();
  if (lower === "::1" || lower === "::" || lower === "0:0:0:0:0:0:0:1")
    return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
  if (
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  ) {
    return true; // fe80::/10 link-local
  }
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice(7);
    if (net.isIP(mapped) === 4) return isBlockedIpv4(mapped);
  }
  return false;
}

export interface SsrfValidationResult {
  allowed: boolean;
  normalizedUrl?: string;
  reason?: string;
}

/**
 * Validates that an outbound HTTP/HTTPS URL does not target localhost,
 * internal hostnames, or DNS records resolving to private/metadata IPs.
 */
export async function validateSafeExternalUrl(
  rawUrl: string,
): Promise<SsrfValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { allowed: false, reason: `SSRF guard: invalid URL "${rawUrl}"` };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      allowed: false,
      reason: `Disallowed URL protocol: ${parsed.protocol}`,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      allowed: false,
      reason: "SSRF guard: embedded credentials in URL are not allowed",
    };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return {
      allowed: false,
      reason: `SSRF guard: blocked local hostname "${hostname}"`,
    };
  }

  if (net.isIP(hostname) !== 0) {
    if (isBlockedIpAddress(hostname)) {
      return {
        allowed: false,
        reason: `SSRF guard: blocked IP address "${hostname}"`,
      };
    }
    return { allowed: true, normalizedUrl: parsed.toString() };
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (records.length === 0) {
      return {
        allowed: false,
        reason: `SSRF guard: no DNS records for "${hostname}"`,
      };
    }
    for (const record of records) {
      if (isBlockedIpAddress(record.address)) {
        return {
          allowed: false,
          reason: `SSRF guard: "${hostname}" resolved to blocked IP ${record.address}`,
        };
      }
    }
  } catch {
    return {
      allowed: false,
      reason: `SSRF guard: DNS resolution failed for "${hostname}"`,
    };
  }

  return { allowed: true, normalizedUrl: parsed.toString() };
}

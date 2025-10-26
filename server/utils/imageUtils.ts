import { lookup } from 'dns/promises';
import { isIP } from 'net';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS metadata
  'metadata.google.internal', // GCP metadata
];

function isPrivateOrLocalIP(ip: string): boolean {
  // Handle IPv6-mapped IPv4 addresses
  const normalizedIP = ip.replace(/^::ffff:/i, '');
  
  // IPv4 private ranges
  const ipv4PrivateRanges = [
    /^10\./,
    /^127\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./, // Link-local
    /^0\.0\.0\.0$/,
  ];
  
  // IPv6 private/local ranges
  const ipv6PrivateRanges = [
    /^::1$/, // Loopback
    /^fe80:/i, // Link-local
    /^fc00:/i, // Unique local
    /^fd00:/i, // Unique local
    /^::$/,    // Unspecified
  ];
  
  return ipv4PrivateRanges.some(range => range.test(normalizedIP)) ||
         ipv6PrivateRanges.some(range => range.test(ip));
}

async function validateHostname(hostname: string): Promise<boolean> {
  try {
    // Resolve DNS to check actual IP addresses
    const addresses = await lookup(hostname, { all: true });
    
    for (const addr of addresses) {
      if (isPrivateOrLocalIP(addr.address)) {
        console.error(`Hostname ${hostname} resolves to private/local IP: ${addr.address}`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to resolve hostname ${hostname}:`, error);
    return false;
  }
}

export async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const parsedUrl = new URL(url);
    
    // Protocol validation
    if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
      console.error(`Invalid protocol: ${parsedUrl.protocol}`);
      return null;
    }
    
    // Blocked hosts validation
    const hostname = parsedUrl.hostname.toLowerCase();
    if (BLOCKED_HOSTS.some(blocked => hostname === blocked || hostname.endsWith(`.${blocked}`))) {
      console.error(`Blocked host: ${hostname}`);
      return null;
    }
    
    // Check if hostname is already an IP address
    const ipVersion = isIP(hostname);
    if (ipVersion !== 0) {
      // It's an IP address, check if it's private/local
      if (isPrivateOrLocalIP(hostname)) {
        console.error(`Private/local IP address blocked: ${hostname}`);
        return null;
      }
    } else {
      // It's a hostname, validate it resolves to public IPs
      const isValid = await validateHostname(hostname);
      if (!isValid) {
        console.error(`Hostname validation failed: ${hostname}`);
        return null;
      }
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BookmarkManager/1.0)',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'manual', // Prevent automatic redirects
    });
    
    // Check for redirects
    if (response.status >= 300 && response.status < 400) {
      console.error(`URL ${url} returned redirect status ${response.status}, rejecting`);
      return null;
    }

    if (!response.ok) {
      console.error(`Failed to fetch image from ${url}: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      console.error(`URL ${url} is not an image (${contentType})`);
      return null;
    }
    
    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
      console.error(`Image too large: ${contentLength} bytes`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    
    // Double-check size after download
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
      console.error(`Image too large after download: ${arrayBuffer.byteLength} bytes`);
      return null;
    }
    
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error(`Error fetching image from ${url}:`, error);
    return null;
  }
}

export function isBase64Image(value: string): boolean {
  return value.startsWith('data:image/');
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

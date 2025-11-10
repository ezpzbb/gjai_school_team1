import axios from 'axios';
import https from 'https';
import path from 'path';
import fs from 'fs';

type CacheEntry = {
  streamUrl: string;
  expiresAt: number;
};

const STREAM_CACHE_TTL =
  Number(process.env.CCTV_STREAM_CACHE_TTL || 5 * 60 * 1000);

const cache = new Map<string, CacheEntry>();

let httpsAgent: https.Agent | undefined;

const caPath = process.env.NODE_EXTRA_CA_CERTS || process.env.UTIC_CA_PATH;
if (caPath) {
  try {
    const resolvedPath = path.isAbsolute(caPath)
      ? caPath
      : path.resolve(process.cwd(), caPath);
    const caContent = fs.readFileSync(resolvedPath, 'utf8');
    httpsAgent = new https.Agent({ ca: caContent });
    console.log('[CCTVStreamResolver] Custom CA loaded:', resolvedPath);
  } catch (error) {
    console.error(
      '[CCTVStreamResolver] Failed to load CA certificate:',
      (error as Error).message,
    );
  }
}

const sanitizeStreamCandidate = (candidate: string): string | null => {
  if (!candidate) {
    return null;
  }

  let cleaned = candidate.trim();
  cleaned = cleaned.replace(/--+>?$/, '');
  cleaned = cleaned.replace(/;+$/, '');
  cleaned = cleaned.replace(/\)+$/, '');
  cleaned = cleaned.replace(/&amp;/gi, '&');
  cleaned = cleaned.replace(/\\u0026/g, '&');

  if (!/^https?:\/\//i.test(cleaned)) {
    return null;
  }

  try {
    return decodeURI(cleaned);
  } catch {
    return cleaned;
  }
};

const extractStreamFromHtml = (html: string): string | null => {
  const hlsRegex = /https?:\/\/[^"'<>\\s]+\.m3u8[^"'<>\\s]*/gi;
  let match: RegExpExecArray | null;
  while ((match = hlsRegex.exec(html)) !== null) {
    const sanitized = sanitizeStreamCandidate(match[0]);
    if (sanitized && !sanitized.toLowerCase().includes('undefined')) {
      return sanitized;
    }
  }

  const mp4Regex = /https?:\/\/[^"'<>\\s]+\.mp4[^"'<>\\s]*/gi;
  while ((match = mp4Regex.exec(html)) !== null) {
    const sanitized = sanitizeStreamCandidate(match[0]);
    if (sanitized && !sanitized.toLowerCase().includes('undefined')) {
      return sanitized;
    }
  }

  return null;
};

const buildGwangjuFallback = (endpoint: URL): string | null => {
  const kind = endpoint.searchParams.get('kind')?.toLowerCase();
  const channelRaw = endpoint.searchParams.get('cctvch');
  const idRaw = endpoint.searchParams.get('id');

  if (kind !== 'v' || !channelRaw || !idRaw) {
    return null;
  }

  const channel = channelRaw.match(/\d+/)?.[0];
  const id = idRaw.match(/\d+/)?.[0];

  if (!channel || !id) {
    return null;
  }

  return `https://gjtic.go.kr/cctv${channel}/livehttp/${id}_video2/chunklist.m3u8`;
};

export class CCTVStreamResolver {
  async resolve(apiEndpoint: string): Promise<string> {
    const normalized = this.normalizeEndpoint(apiEndpoint);

    const cached = cache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.streamUrl;
    }

    if (normalized.toLowerCase().includes('.m3u8')) {
      cache.set(normalized, {
        streamUrl: normalized,
        expiresAt: Date.now() + STREAM_CACHE_TTL,
      });
      return normalized;
    }

    const endpointUrl = new URL(normalized);
    const fallbackCandidate = buildGwangjuFallback(endpointUrl);

    try {
      const response = await axios.get<string>(normalized, {
        httpsAgent,
        responseType: 'text',
        timeout: Number(process.env.CCTV_STREAM_TIMEOUT || 15000),
        headers: {
          'User-Agent':
            process.env.CCTV_STREAM_USER_AGENT ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp',
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const extracted = extractStreamFromHtml(response.data);
      if (extracted) {
        cache.set(normalized, {
          streamUrl: extracted,
          expiresAt: Date.now() + STREAM_CACHE_TTL,
        });
        return extracted;
      }
    } catch (error: any) {
      console.warn(
        '[CCTVStreamResolver] Failed to fetch UTIC page:',
        error.message || error,
      );
    }

    if (fallbackCandidate) {
      cache.set(normalized, {
        streamUrl: fallbackCandidate,
        expiresAt: Date.now() + STREAM_CACHE_TTL,
      });
      return fallbackCandidate;
    }

    throw new Error('STREAM_URL_NOT_FOUND');
  }

  private normalizeEndpoint(endpoint: string): string {
    try {
      return new URL(endpoint).toString();
    } catch {
      if (!endpoint.startsWith('http')) {
        throw new Error('INVALID_ENDPOINT_URL');
      }
      return endpoint;
    }
  }
}

export const cctvStreamResolver = new CCTVStreamResolver();


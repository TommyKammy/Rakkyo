import crypto from 'crypto';

export interface TokenPayload {
  expiresAt: number;
  [key: string]: any;
}

export function generateSignedToken(payload: TokenPayload, secret: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

export type TokenVerifyResult<T> =
  | { ok: true; payload: T }
  | { ok: false; reason: 'bad_signature' | 'expired' | 'malformed' };

export function verifySignedToken<T extends TokenPayload>(
  token: string,
  secret: string
): TokenVerifyResult<T> {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'malformed' };
  }
  
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [payloadB64, signature] = parts;

  let signatureMatches = false;
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('base64url');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const signatureBuffer = Buffer.from(signature, 'utf-8');
    if (expectedBuffer.length === signatureBuffer.length) {
      signatureMatches = crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    }
  } catch {
    return { ok: false, reason: 'bad_signature' };
  }
  if (!signatureMatches) return { ok: false, reason: 'bad_signature' };

  try {
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (typeof decoded?.expiresAt !== 'number') {
      return { ok: false, reason: 'malformed' };
    }
    if (decoded.expiresAt < Date.now()) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, payload: decoded as T };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}
export interface CelebrationPayload extends TokenPayload {
  childId: string;
  attemptId: string;
}

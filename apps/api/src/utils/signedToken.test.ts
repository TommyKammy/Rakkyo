import { generateSignedToken, verifySignedToken, TokenPayload } from './signedToken';

describe('signedToken utility', () => {
  const secret = 'my-super-secret-key-for-testing';

  it('should successfully sign and verify a valid token', () => {
    const payload: TokenPayload = {
      expiresAt: Date.now() + 10000,
      userId: 'test-user-id',
      avatarId: 'test-avatar-id',
    };

    const token = generateSignedToken(payload, secret);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(2);

    const result = verifySignedToken<TokenPayload>(token, secret);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.userId).toBe('test-user-id');
      expect(result.payload.avatarId).toBe('test-avatar-id');
    }
  });

  it('should reject an expired token', () => {
    const payload: TokenPayload = {
      expiresAt: Date.now() - 1000, // Expired 1 second ago
      userId: 'test-user-id',
    };

    const token = generateSignedToken(payload, secret);
    const result = verifySignedToken(token, secret);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('expired');
    }
  });

  it('should reject a tampered token payload or signature', () => {
    const payload: TokenPayload = {
      expiresAt: Date.now() + 10000,
      userId: 'test-user-id',
    };

    const token = generateSignedToken(payload, secret);
    const [payloadB64, signature] = token.split('.');

    // Tamper with payload
    const tamperedDecoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    tamperedDecoded.expiresAt = Date.now() + 1000000; // Tampered expiration
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(tamperedDecoded)).toString('base64url');
    const tamperedToken = `${tamperedPayloadB64}.${signature}`;

    const result = verifySignedToken(tamperedToken, secret);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('bad_signature');
    }
  });

  it('should handle malformed inputs gracefully', () => {
    expect(verifySignedToken('', secret).ok).toBe(false);
    expect(verifySignedToken('malformed_token_without_dot', secret).ok).toBe(false);
    expect(verifySignedToken('a.b.c', secret).ok).toBe(false);
  });
});

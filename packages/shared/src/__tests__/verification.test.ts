/**
 * Verification utility tests
 */

import { describe, expect, it } from 'vitest';
import { TypingProof, computeHash, verifyInitialHashRoot } from '../index.js';
import type { FingerprintComponents } from '../types.js';

const createMockFingerprintComponents = (): FingerprintComponents => ({
  userAgent: 'Mozilla/5.0 (Verification Test)',
  language: 'ja',
  languages: ['ja', 'en'],
  platform: 'TestOS',
  hardwareConcurrency: 8,
  deviceMemory: 16,
  screen: {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: 1,
  },
  timezone: 'Asia/Tokyo',
  timezoneOffset: -540,
  canvas: 'mock-canvas-fingerprint',
  webgl: {
    vendor: 'Mock Vendor',
    renderer: 'Mock Renderer',
  },
  fonts: ['Arial', 'Helvetica'],
  cookieEnabled: true,
  doNotTrack: 'unspecified',
  maxTouchPoints: 0,
});

describe('verification utilities', () => {
  it('verifies that the initial chain hash is bound to the fingerprint nonce', async () => {
    const components = createMockFingerprintComponents();
    const fingerprintHash = await computeHash(JSON.stringify(components, null, 0));
    const proof = new TypingProof();

    await proof.initialize(fingerprintHash, components);
    await proof.recordEvent({
      type: 'contentChange',
      inputType: 'insertText',
      data: 'a',
      rangeOffset: 0,
      rangeLength: 0,
    });

    const exported = await proof.exportProof('a');

    await expect(verifyInitialHashRoot(exported)).resolves.toMatchObject({
      valid: true,
    });
  });

  it('rejects a tampered initial hash nonce', async () => {
    const components = createMockFingerprintComponents();
    const fingerprintHash = await computeHash(JSON.stringify(components, null, 0));
    const proof = new TypingProof();

    await proof.initialize(fingerprintHash, components);
    const exported = await proof.exportProof('');
    exported.typingProofData.initialHashNonce = '0'.repeat(64);

    await expect(verifyInitialHashRoot(exported)).resolves.toMatchObject({
      valid: false,
      reason: 'Initial event chain hash does not match fingerprint and nonce',
    });
  });
});

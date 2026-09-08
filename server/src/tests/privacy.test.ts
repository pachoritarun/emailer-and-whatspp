import test from 'node:test';
import assert from 'node:assert';
import { sanitizePrivacyData } from '../services/logger.js';

test('Privacy Filter: Strict phone number and secret redaction', () => {
  const sensitivePayload = {
    campaign_id: 'CMP-12345',
    recipient_id: 'UUID-9876',
    recipient_phone: '+14155552671',
    user_mobile: '9876543210',
    meta_token: 'EAABcdef1234567890abcdef',
    nested_details: {
      phone_number: '+447911123456',
      bearer_auth: 'Bearer my_secret_token_value',
      notes: 'Please contact the student at +919876543210 regarding the exam.'
    }
  };

  const sanitized = sanitizePrivacyData(sensitivePayload);

  // Assert keys containing phone are redacted
  assert.strictEqual(sanitized.recipient_phone, '[REDACTED_PHONE]');
  assert.strictEqual(sanitized.user_mobile, '[REDACTED_PHONE]');
  assert.strictEqual(sanitized.nested_details.phone_number, '[REDACTED_PHONE]');

  // Assert tokens/secrets are redacted
  assert.strictEqual(sanitized.meta_token, '[REDACTED_SECRET]');

  // Assert inline phone numbers in arbitrary strings are redacted
  assert.ok(!sanitized.nested_details.notes.includes('+919876543210'));
  assert.ok(sanitized.nested_details.notes.includes('[REDACTED_PHONE]'));

  // Assert IDs remain untouched
  assert.strictEqual(sanitized.campaign_id, 'CMP-12345');
  assert.strictEqual(sanitized.recipient_id, 'UUID-9876');
});

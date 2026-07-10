const assert = require('node:assert/strict');
const test = require('node:test');

const { validateEnv } = require('../src/config/env');

test('validateEnv returns defaults when optional values are missing', () => {
  const env = validateEnv({});

  assert.equal(env.NODE_ENV, 'development');
  assert.equal(env.PORT, 3000);
  assert.equal(env.SUPABASE_URL, undefined);
  assert.equal(env.SUPABASE_ANON_KEY, undefined);
  assert.equal(env.SUPABASE_SECRET_KEY, undefined);
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.GEMINI_API_KEY, undefined);
  assert.equal(env.GEMINI_MODEL, 'gemini-2.5-flash');
});

test('validateEnv treats empty optional secrets as unset', () => {
  const env = validateEnv({
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    SUPABASE_SECRET_KEY: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    OPENAI_API_KEY: '',
    GEMINI_API_KEY: '',
    GEMINI_MODEL: '',
  });

  assert.equal(env.SUPABASE_URL, undefined);
  assert.equal(env.SUPABASE_ANON_KEY, undefined);
  assert.equal(env.SUPABASE_SECRET_KEY, undefined);
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.GEMINI_API_KEY, undefined);
  assert.equal(env.GEMINI_MODEL, 'gemini-2.5-flash');
});

test('validateEnv coerces a valid PORT string to a number', () => {
  const env = validateEnv({ PORT: '8080', NODE_ENV: 'test' });

  assert.equal(env.PORT, 8080);
  assert.equal(env.NODE_ENV, 'test');
});

test('validateEnv rejects invalid ports and URLs', () => {
  assert.throws(
    () => validateEnv({ PORT: '0' }),
    /Invalid environment configuration: PORT: Too small/
  );

  assert.throws(
    () => validateEnv({ SUPABASE_URL: 'not-a-url' }),
    /Invalid environment configuration: SUPABASE_URL: Invalid URL/
  );
});

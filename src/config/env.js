const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ quiet: true });

const emptyStringToUndefined = (value) => (value === '' ? undefined : value);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  SUPABASE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  SUPABASE_ANON_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  OPENAI_API_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
});

const formatEnvErrors = (error) =>
  error.issues
    .map((issue) => {
      const path = issue.path.join('.') || 'env';
      return `${path}: ${issue.message}`;
    })
    .join('; ');

const validateEnv = (source = process.env) => {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${formatEnvErrors(result.error)}`);
  }

  return result.data;
};

const env = validateEnv();

module.exports = {
  env,
  validateEnv,
};

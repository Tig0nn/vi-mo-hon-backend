const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({
  quiet: true,
  override: !['test', 'production'].includes(process.env.NODE_ENV),
});

const emptyStringToUndefined = (value) => (value === '' ? undefined : value);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  SUPABASE_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  SUPABASE_ANON_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  SUPABASE_SECRET_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  OPENAI_API_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  GEMINI_API_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  GEMINI_MODEL: z.preprocess(emptyStringToUndefined, z.string().min(1).default('gemini-2.5-flash')),
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

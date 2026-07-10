const { createClient } = require('@supabase/supabase-js');
const { env } = require('./env');

let supabaseClient = null;

const getSupabaseSecretKey = () => env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

const createSupabaseClient = () => {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseSecretKey = getSupabaseSecretKey();

  if (!supabaseUrl) {
    throw new Error('Missing required environment variable SUPABASE_URL');
  }

  if (!supabaseSecretKey) {
    throw new Error('Missing required environment variable SUPABASE_SECRET_KEY');
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient();
  }

  return supabaseClient;
};

module.exports = {
  getSupabaseClient,
};

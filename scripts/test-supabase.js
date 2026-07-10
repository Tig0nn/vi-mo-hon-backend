const { getSupabaseClient } = require('../src/config/supabase');

const run = async () => {
  try {
    const { data, error } = await getSupabaseClient()
      .from('bosses')
      .select('id, name, max_hp')
      .limit(5);

    if (error) {
      throw error;
    }

    console.log(`Supabase connection successful. Read ${data.length} bosses row(s).`);
    process.exitCode = 0;
  } catch (error) {
    const message = error && error.message ? error.message : 'Unknown Supabase connection error';
    const cause = error && error.cause ? error.cause : null;
    const causeDetails = cause && (cause.code || cause.message) ? ` (${cause.code || cause.message})` : '';
    console.error(`Supabase connection failed: ${message}${causeDetails}`);
    process.exitCode = 1;
  }
};

run();

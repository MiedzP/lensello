import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      return Response.json({ error: 'Missing env vars', url: !!url, key: !!anonKey }, { status: 500 });
    }

    const client = createClient(url, anonKey);

    // Test simple query
    const { data, error } = await client.from('profiles').select('count');

    if (error) {
      return Response.json({ error: error.message, data: null }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

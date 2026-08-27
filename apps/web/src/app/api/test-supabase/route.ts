import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const admin = createAdminClient();

    // Test the connection
    const { data, error } = await admin
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) {
      return Response.json({
        status: 'error',
        message: 'Supabase query failed',
        error: error.message,
        code: error.code,
      }, { status: 500 });
    }

    return Response.json({
      status: 'success',
      message: 'Supabase connection working',
      data,
    });
  } catch (err) {
    const error = err as Error;
    return Response.json({
      status: 'error',
      message: 'Connection test failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}

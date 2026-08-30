const { createClient } = require('@supabase/supabase-js');

const url = 'https://lfhsuiwmtlhljrjsjvwg.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaHN1aXdtdGxobGpyanNqdndnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NTMzODksImV4cCI6MjEwMzAyOTM4OX0.UxX8dKE49nIegBqEg525vP-AOrC0jRfdnNAnJqQpurc';

const client = createClient(url, anonKey);

async function test() {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await client.from('profiles').select('count');
    if (error) {
      console.error('Query error:', error);
    } else {
      console.log('✓ Supabase is responding!');
      console.log('Data:', data);
    }
  } catch (err) {
    console.error('Connection error:', err.message);
  }
}

test();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
    email: 'vishalkishorekumar@gmail.com',
    password: 'password123'
  });
  const id = require('crypto').randomUUID();
  const { data, error } = await supabase.from('entries').insert({
    id: id,
    user_id: user.id,
    results: [{ type: 'note', title: 'Test', body: 'Test' }],
    is_quick_note: true
  }).select();
  console.log('Error:', error);
  console.log('Data:', data);
  if (data) {
    await supabase.from('entries').delete().eq('id', id);
  }
}
test();

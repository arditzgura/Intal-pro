const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let userId;
  try {
    ({ userId } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  if (!userId) {
    return { statusCode: 400, body: 'Missing userId' };
  }

  // Delete user data from all tables first
  await supabaseAdmin.from('invoices').delete().eq('user_id', userId);
  await supabaseAdmin.from('clients').delete().eq('user_id', userId);
  await supabaseAdmin.from('items').delete().eq('user_id', userId);
  await supabaseAdmin.from('stock_entries').delete().eq('user_id', userId);
  await supabaseAdmin.from('user_config').delete().eq('user_id', userId);
  await supabaseAdmin.from('profiles').delete().eq('user_id', userId);

  // Delete the auth user
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};

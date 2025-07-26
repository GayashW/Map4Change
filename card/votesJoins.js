import { supabase } from './supabaseClient.js';
import { getUserId } from './user.js';

export async function toggleVote(entryId) {
  const userId = getUserId();
  const { data } = await supabase.from('votes').select('*').eq('entry_id', entryId).eq('user_id', userId);
  if (data?.length) {
    await supabase.from('votes').delete().eq('entry_id', entryId).eq('user_id', userId);
  } else {
    await supabase.from('votes').insert([{ entry_id: entryId, user_id: userId }]);
  }
}

export async function toggleJoin(entryId) {
  const userId = getUserId();
  const { data } = await supabase.from('joins').select('*').eq('entry_id', entryId).eq('user_id', userId);
  if (data?.length) {
    await supabase.from('joins').delete().eq('entry_id', entryId).eq('user_id', userId);
  } else {
    await supabase.from('joins').insert([{ entry_id: entryId, user_id: userId }]);
  }
}

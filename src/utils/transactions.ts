import { SupabaseClient } from '@supabase/supabase-js';

export async function insertWalletItems(validItems: any[], userId: string, supabase: SupabaseClient) {
  const promises = validItems.map(async (parsedItem: any) => {
    if (parsedItem.type === 'income') {
      const { data, error } = await supabase.from('income').insert({
        user_id: userId,
        amount: parsedItem.amount || 0,
        description: parsedItem.title || 'Unknown Income',
        source: parsedItem.source || 'General',
        date: parsedItem.date || new Date().toISOString().split('T')[0]
      }).select().single();
      
      if (error) throw error;
      return { ...data, isIncome: true, dbTable: 'income' };
    } else {
      const { data, error } = await supabase.from('expenses').insert({
        user_id: userId,
        amount: parsedItem.amount || 0,
        description: parsedItem.title || 'Unknown Expense',
        category: parsedItem.category || 'General',
        date: parsedItem.date || new Date().toISOString().split('T')[0],
        split_details: parsedItem.split_details || null,
        split_participants: parsedItem.split_participants || null
      }).select().single();
      
      if (error) throw error;
      return { ...data, isIncome: false, dbTable: 'expenses' };
    }
  });

  return await Promise.all(promises);
}

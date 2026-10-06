export const TRASH_DAYS = 30;

export function daysLeft(deletedAt: string | null): number {
  if (!deletedAt) return TRASH_DAYS;
  const deletedDate = new Date(deletedAt);
  const now = new Date();
  const diffTime = now.getTime() - deletedDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, TRASH_DAYS - diffDays);
}

export function extractImagePaths(text: string, userId: string): string[] {
  if (!text) return [];
  const paths: string[] = [];
  
  // Match markdown ![...](url)
  const mdRegex = /!\[.*?\]\((.*?)\)/g;
  let match;
  while ((match = mdRegex.exec(text)) !== null) {
    paths.push(match[1]);
  }
  
  // Match HTML <img src="url">
  const htmlRegex = /<img[^>]+src="([^">]+)"/g;
  while ((match = htmlRegex.exec(text)) !== null) {
    paths.push(match[1]);
  }
  
  return paths.filter(url => url.includes('/note-images/')).map(url => {
    const parts = url.split('/note-images/');
    return parts[1]; // Get path after bucket
  }).filter(path => path && path.startsWith(`${userId}/`));
}

export async function deleteForever(supabase: any, userId: string, table: 'entries' | 'quick_notes', rows: any[]) {
  if (!rows || rows.length === 0) return;
  
  // 1. Gather all file paths to delete
  const pathsToDelete = new Set<string>();
  
  for (const row of rows) {
    let textToParse = '';
    
    if (table === 'entries') {
      textToParse = JSON.stringify(row.results || []);
      
      if (row.image_urls && Array.isArray(row.image_urls)) {
        for (const url of row.image_urls) {
           if (typeof url === 'string' && url.includes('/note-images/')) {
             const path = url.split('/note-images/')[1];
             if (path && path.startsWith(`${userId}/`)) {
               pathsToDelete.add(path);
             }
           }
        }
      }
    } else if (table === 'quick_notes') {
      textToParse = row.content || '';
    }
    
    const extracted = extractImagePaths(textToParse, userId);
    for (const p of extracted) {
      pathsToDelete.add(p);
    }
  }
  
  // 2. Delete from storage
  if (pathsToDelete.size > 0) {
    const pathsArray = Array.from(pathsToDelete);
    for (let i = 0; i < pathsArray.length; i += 100) {
      const chunk = pathsArray.slice(i, i + 100);
      await supabase.storage.from('note-images').remove(chunk);
    }
  }
  
  // 3. Delete the rows
  const ids = rows.map(r => r.id);
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    await supabase.from(table).delete().in('id', chunk);
  }
}

export async function purgeExpiredTrash(supabase: any, userId: string) {
  try {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - TRASH_DAYS);
    const expiredStr = expirationDate.toISOString();
    
    // Purge entries
    const { data: expiredEntries } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .not('deleted_at', 'is', null)
      .lt('deleted_at', expiredStr);
      
    if (expiredEntries && expiredEntries.length > 0) {
      await deleteForever(supabase, userId, 'entries', expiredEntries);
    }
    
    // Purge quick notes
    const { data: expiredNotes } = await supabase
      .from('quick_notes')
      .select('*')
      .eq('user_id', userId)
      .not('deleted_at', 'is', null)
      .lt('deleted_at', expiredStr);
      
    if (expiredNotes && expiredNotes.length > 0) {
      await deleteForever(supabase, userId, 'quick_notes', expiredNotes);
    }
  } catch (error) {
    console.error('Failed to purge expired trash:', error);
  }
}

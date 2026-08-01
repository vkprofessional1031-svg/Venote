import { SupabaseClient } from '@supabase/supabase-js';

export async function insertPrepItems(items: any[], userId: string, supabase: SupabaseClient) {
  const processedItems = [];

  for (const item of items) {
    if (item.type === 'round') {
      const companyName = item.company || 'Unknown Company';
      const roleName = item.role || 'Software Engineer';
      
      let appId = null;
      
      // Look up existing application in DB
      const { data: existingApps } = await supabase
        .from('job_applications')
        .select('id, company')
        .eq('user_id', userId)
        .ilike('company', companyName)
        .limit(1);
        
      if (existingApps && existingApps.length > 0) {
        appId = existingApps[0].id;
      } else {
        const { data: newApp, error: newAppErr } = await supabase
          .from('job_applications')
          .insert({
            user_id: userId,
            company: companyName,
            role: roleName,
          })
          .select()
          .single();
          
        if (newAppErr) throw newAppErr;
        appId = newApp.id;
      }

      let parsedDeadline = null;
      if (item.deadline) {
        let dl = item.deadline;
        if (dl.length === 10) {
          dl = `${dl}T23:59:59`;
        }
        dl = dl.replace('Z', '');
        parsedDeadline = new Date(dl).toISOString();
      }

      const { data: roundData, error: roundErr } = await supabase
        .from('application_rounds')
        .insert({
          user_id: userId,
          application_id: appId,
          round_name: item.round_name || 'Interview',
          deadline: parsedDeadline,
          notes: item.notes || null,
          status: 'upcoming'
        }).select().single();
        
      if (roundErr) throw roundErr;
      processedItems.push({ ...roundData, itemType: 'round', companyName, dbTable: 'application_rounds' });
      
      await recalculateApplicationStatus(appId, supabase);

      
    } else if (item.type === 'prep') {
      let appId = null;
      if (item.company_reference) {
        const { data: existingApps } = await supabase
          .from('job_applications')
          .select('id')
          .eq('user_id', userId)
          .ilike('company', item.company_reference)
          .limit(1);
          
        if (existingApps && existingApps.length > 0) {
          appId = existingApps[0].id;
        }
      }
      
      const { data: prepData, error: prepErr } = await supabase
        .from('prep_sessions')
        .insert({
          user_id: userId,
          prep_type: item.prep_type || 'Prep Session',
          count_or_duration: item.count_or_duration || null,
          date: new Date().toISOString().split('T')[0],
          application_id: appId
        }).select().single();
        
      if (prepErr) throw prepErr;
      processedItems.push({ ...prepData, itemType: 'prep', prep_type: item.prep_type, dbTable: 'prep_sessions' });
    }
  }

  return processedItems;
}

export async function recalculateApplicationStatus(appId: string, supabase: SupabaseClient) {
  const { data: app, error: appErr } = await supabase
    .from('job_applications')
    .select('status, status_manually_set')
    .eq('id', appId)
    .single();

  if (appErr || !app) {
    console.error('Error fetching application for status recalc:', appErr);
    return;
  }

  if (app.status_manually_set) {
    return;
  }

  const { data: rounds, error: roundsErr } = await supabase
    .from('application_rounds')
    .select('status, round_name, created_at, deadline')
    .eq('application_id', appId);

  if (roundsErr) {
    console.error('Error fetching rounds for status recalc:', roundsErr);
    return;
  }

  let newStatus = 'applied';

  if (rounds && rounds.length > 0) {
    const sortedRounds = [...rounds].sort((a, b) => {
      const dateA = a.deadline ? new Date(a.deadline).getTime() : new Date(a.created_at).getTime();
      const dateB = b.deadline ? new Date(b.deadline).getTime() : new Date(b.created_at).getTime();
      return dateA - dateB;
    });

    const lastRound = sortedRounds[sortedRounds.length - 1];
    const isRejected = rounds.some(r => r.status === 'rejected');
    const hasUpcoming = rounds.some(r => r.status === 'upcoming');
    const hasOfferCompleted = rounds.some(r => r.round_name.toLowerCase().includes('offer') && r.status === 'completed');
    
    if (isRejected) {
      newStatus = 'rejected';
    } else if (hasOfferCompleted) {
      newStatus = 'accepted';
    } else if (!hasUpcoming && lastRound && lastRound.status === 'completed') {
      newStatus = 'accepted';
    } else if (hasUpcoming || rounds.some(r => r.status === 'completed')) {
      newStatus = 'in_progress';
    }
  }

  if (newStatus !== app.status) {
    await supabase
      .from('job_applications')
      .update({ status: newStatus })
      .eq('id', appId);
  }
}


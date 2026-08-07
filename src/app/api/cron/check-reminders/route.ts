import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Configure Web Push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:notifications@venote.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

function verifyCronAuth(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // If no secret configured in dev, allow execution
    return true;
  }

  const authHeader = req.headers.get('authorization');
  const customHeader = req.headers.get('x-cron-secret');
  const urlSecret = req.nextUrl.searchParams.get('secret');

  if (authHeader && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }
  if (customHeader && customHeader === cronSecret) {
    return true;
  }
  if (urlSecret && urlSecret === cronSecret) {
    return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  return handleCronReminders(req);
}

export async function POST(req: NextRequest) {
  return handleCronReminders(req);
}

async function handleCronReminders(req: NextRequest) {
  // 1. Security Check
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid cron secret' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Database credentials not configured' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  const now = new Date();
  // 10-minute window: 8 to 12 minutes from now
  const windowStart = new Date(now.getTime() + 8 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 12 * 60 * 1000);

  try {
    // 2. Query upcoming unnotified blocks in the 8-12m window
    const { data: blocks, error: blocksError } = await supabase
      .from('schedule_blocks')
      .select('*')
      .is('notified_at', null)
      .gte('start_time', windowStart.toISOString())
      .lte('start_time', windowEnd.toISOString());

    if (blocksError) {
      console.error('Cron error fetching schedule blocks:', blocksError);
      return NextResponse.json({ error: blocksError.message }, { status: 500 });
    }

    if (!blocks || blocks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No upcoming blocks requiring reminder',
        processed: 0,
        notificationsSent: 0,
        timestamp: new Date().toISOString()
      });
    }

    let notificationsSent = 0;
    let expiredSubscriptionsCleaned = 0;

    for (const block of blocks) {
      // Fetch subscriptions for this user
      const { data: subscriptions, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', block.user_id);

      if (subError) {
        console.error(`Error fetching subscriptions for user ${block.user_id}:`, subError);
        continue;
      }

      const blockStart = new Date(block.start_time);
      const formattedTime = blockStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

      const payload = JSON.stringify({
        title: `⏰ Upcoming: ${block.title}`,
        body: `Starts in ~10 minutes at ${formattedTime}${block.notes ? ` • ${block.notes}` : ''}`,
        icon: '/icon.svg',
        tag: `schedule-${block.id}`,
        url: '/app/schedule'
      });

      if (subscriptions && subscriptions.length > 0) {
        for (const sub of subscriptions) {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          };

          try {
            await webpush.sendNotification(pushSubscription, payload);
            notificationsSent++;
          } catch (err: any) {
            console.warn('Push send error for endpoint:', sub.endpoint, err?.statusCode);
            // If subscription is expired/unregistered (410 or 404), clean it up
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', sub.endpoint);
              expiredSubscriptionsCleaned++;
            }
          }
        }
      }

      // Mark block as notified
      await supabase
        .from('schedule_blocks')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', block.id);
    }

    return NextResponse.json({
      success: true,
      blocksProcessed: blocks.length,
      notificationsSent,
      expiredSubscriptionsCleaned,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Unhandled cron error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

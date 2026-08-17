'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { driver } from 'driver.js';
import { supabase } from '@/lib/supabase';

interface OnboardingTourProps {
  userId: string | undefined;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
}

export default function OnboardingTour({ userId, setIsMobileMenuOpen }: OnboardingTourProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTourActive = useRef(false);

  useEffect(() => {
    if (!userId) return;

    const checkAndRunTour = async () => {
      // Check if manually triggered via query parameter
      const forceTour = searchParams.get('tour') === 'true';

      if (!forceTour) {
        // Otherwise check the database
        const { data, error } = await supabase
          .from('user_settings')
          .select('has_seen_tour')
          .eq('user_id', userId)
          .single();

        // PGRST116 = no rows found, which means a brand new user — should see the tour
        if (data?.has_seen_tour === true) {
          return;
        }
      }

      if (isTourActive.current) return;
      isTourActive.current = true;

      // Clean up the URL if it was manually triggered
      if (forceTour) {
        router.replace('/app');
      }

      const driverObj = driver({
        showProgress: true,
        allowClose: true,
        overlayOpacity: 0.65,
        steps: [
          {
            element: '[data-tour="organize-input"]',
            popover: {
              title: 'Organize your thoughts',
              description: "Type anything here — tasks, notes, expenses, job updates. I'll figure out where it goes.",
              side: 'bottom',
              align: 'center',
            }
          },
          {
            element: '[data-tour="nav-wallet"]',
            popover: {
              title: 'Wallet',
              description: "Track spending and income here.",
              side: 'right',
              align: 'center',
            }
          },
          {
            element: '[data-tour="nav-job"]',
            popover: {
              title: 'Job',
              description: "Manage job applications and interview prep.",
              side: 'right',
              align: 'center',
            }
          },
          {
            element: '[data-tour="nav-schedule"]',
            popover: {
              title: 'Schedule',
              description: "Time-block your week.",
              side: 'right',
              align: 'center',
            }
          },
          {
            element: '[data-tour="nav-settings"]',
            popover: {
              title: 'Settings',
              description: "Adjust preferences, or retake this tour anytime.",
              side: 'right',
              align: 'start',
            }
          }
        ],
        onHighlightStarted: (element, step, { config, state }) => {
          const stepIndex = state.activeIndex;
          
          // If we are navigating to sidebar steps (index 1 to 4) on mobile
          if (stepIndex !== undefined && stepIndex >= 1 && window.innerWidth < 768) {
            setIsMobileMenuOpen(true);
            // Delay to let the CSS transition slide the drawer in before spotlighting
            return new Promise((resolve) => {
              setTimeout(resolve, 300);
            });
          }
        },
        onDestroyed: async () => {
          isTourActive.current = false;
          
          // Close mobile menu if it was opened during the tour
          if (window.innerWidth < 768) {
            setIsMobileMenuOpen(false);
          }

          // Mark as seen in DB
          if (userId) {
            await supabase.from('user_settings')
              .upsert({ user_id: userId, has_seen_tour: true }, { onConflict: 'user_id' });
          }
        }
      });

      driverObj.drive();
    };

    // Small delay to ensure the DOM elements are fully mounted
    const timeoutId = setTimeout(checkAndRunTour, 500);
    return () => clearTimeout(timeoutId);
  }, [userId, searchParams, router, setIsMobileMenuOpen]);

  return null;
}

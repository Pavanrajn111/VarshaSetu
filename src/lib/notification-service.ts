/**
 * Varsha Setu (SIH 26086) — Farmer Notification Push Gateway (Scaffold)
 * Dispatches toast notifications and logs subscription payloads.
 * Swapping in a production Twilio / WhatsApp Cloud API is isolated here.
 */

import { toast } from 'sonner';
import type { SupportedLanguage } from './types';

export interface NotificationSubscription {
  phone: string;
  channels: ('sms' | 'whatsapp')[];
  language: SupportedLanguage;
  location: string;
  crop: string;
}

export async function subscribeToAdvisories(
  payload: NotificationSubscription
): Promise<{ success: boolean; message: string }> {
  // Log subscription to console for judging and developer review
  console.log('[NotificationService] Registered farmer alert subscription:', payload);

  // Simulated 600ms network round-trip
  await new Promise((resolve) => setTimeout(resolve, 600));

  // TODO: connect to Twilio / WhatsApp Business API once credentials are available
  const channelLabels = payload.channels.map((c) => (c === 'sms' ? 'SMS' : 'WhatsApp')).join(' & ');

  toast.success('Subscription Active!', {
    description: `Farmer alerts for ${payload.crop} in ${payload.location} will be sent via ${channelLabels} (+91 ${payload.phone}).`,
  });

  return {
    success: true,
    message: 'Farmer advisory subscription active.',
  };
}

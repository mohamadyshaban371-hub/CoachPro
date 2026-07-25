import {
  createUserActivityEntry,
  type ActivityType as ServiceActivityType,
} from '../core/services/users.service';

export type ActivityType = ServiceActivityType;

export interface ClientActivity {
  type: ActivityType;
  title: string;
  userId: string;
  userName: string;
  metadata?: Record<string, any>;
  createdAt?: any;
  isRead?: boolean;
}

/**
 * Append a single activity entry to /users/{uid}/clientActivity.
 * Admins read this whole subcollection in real time to power
 * the "Big Brother" view + recent-activity feed + alerts.
 *
 * Failures are swallowed (logged) so a slow Firestore write never
 * blocks the user-facing UI action that triggered it.
 */
export async function logClientActivity(
  userId: string,
  userName: string,
  type: ActivityType,
  title: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await createUserActivityEntry({
      userId,
      userName,
      type,
      title,
      metadata,
    });
  } catch (err) {
    console.warn('[activityLog] Failed to write activity:', (err as Error)?.message);
  }
}

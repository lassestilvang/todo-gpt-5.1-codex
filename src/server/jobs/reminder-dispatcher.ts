import {
  fetchDueReminders,
  markReminderSent,
  snoozeReminder,
} from "@/server/services/reminder-service";

export type ReminderDeliveryResult = {
  reminderId: string;
  success: boolean;
  error?: string;
};

export type ReminderDeliveryHandler = (reminderId: string) => Promise<void>;

export async function runReminderDispatcher(
  deliver: ReminderDeliveryHandler,
  windowMinutes = 5
): Promise<ReminderDeliveryResult[]> {
  const due = await fetchDueReminders(windowMinutes);
  const outcomes: ReminderDeliveryResult[] = [];

  for (const reminder of due) {
    try {
      await deliver(reminder.id);
      await markReminderSent(reminder.id);
      outcomes.push({ reminderId: reminder.id, success: true });
    } catch (error) {
      await snoozeReminder(reminder.id, 5);
      outcomes.push({
        reminderId: reminder.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return outcomes;
}

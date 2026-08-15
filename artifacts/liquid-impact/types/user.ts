export interface UserPreference {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  preferredNotificationTime?: string;
  doNotDisturbStart?: string;
  doNotDisturbEnd?: string;
}

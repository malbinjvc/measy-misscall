-- Set the shared Twilio number used for OTP verification during onboarding
UPDATE "PlatformSettings" SET "sharedTwilioNumber" = '+13656543756'
  WHERE id = 'platform-settings' AND "sharedTwilioNumber" IS NULL;

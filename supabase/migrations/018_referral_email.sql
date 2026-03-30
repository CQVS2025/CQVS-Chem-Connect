-- Add email field to referrals table for sending intro emails to referred contacts
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referred_email text;

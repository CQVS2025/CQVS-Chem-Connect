-- Migration: Add status column to profiles
-- Run this in the Supabase SQL Editor

alter table profiles add column if not exists status text not null default 'active';

-- Add index for status filtering
create index if not exists profiles_status_idx on profiles (status);

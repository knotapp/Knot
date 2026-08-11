-- Add premium column to users table
-- Run this in Supabase SQL Editor

alter table public.users add column if not exists premium boolean not null default false;
alter table public.users add column if not exists email text not null default '';

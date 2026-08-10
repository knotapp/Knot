import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dnpfhkajqhqpsqfzpjvo.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRucGZoa2FqcWhxcHNxZnpwanZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzOTM4MTMsImV4cCI6MjEwMTk2OTgxM30.wzrKj6_mXc4Tba2DCshgZfYGWtwWcmFM9kLvHobV7iw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

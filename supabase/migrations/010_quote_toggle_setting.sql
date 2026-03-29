-- Add quote feature toggle setting
insert into admin_settings (key, value) values
  ('quotes_enabled', 'true')
on conflict (key) do nothing;

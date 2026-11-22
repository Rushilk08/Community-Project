-- ==============================================================================
-- WorkLink - Full Supabase Database Schema (Customer & Worker Authorization)
-- ==============================================================================
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/_/sql
-- 2. Click "New Query", paste this entire script, and click "Run".
-- ==============================================================================

-- 1. Create PROFILES Table (stores both customer and worker user data)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  role text not null check (role in ('customer', 'worker')),
  full_name text not null,
  phone text,
  skill text, -- Populated for workers (e.g. Mason, Electrician, Painter, etc.)
  location text default 'Bengaluru, Karnataka',
  organization text, -- Populated for customers (e.g. Construction Co, Residential, etc.)
  avatar_url text,
  is_available boolean default true, -- Worker availability toggle
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- 3. RLS Policies for Profiles
-- Drop existing policies if re-running
drop policy if exists "Authenticated users can read all profiles" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

-- Any authenticated user can read profiles (customers see worker details, workers see employer details)
create policy "Authenticated users can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Allow users to insert their own profile record
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- Allow users to update their own profile record
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 4. Trigger to Automatically Create/Update Profile on Auth Sign-Up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id,
    email,
    role,
    full_name,
    phone,
    skill,
    location,
    organization
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'User'), '@', 1)),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'skill',
    coalesce(new.raw_user_meta_data->>'location', 'Bengaluru, Karnataka'),
    new.raw_user_meta_data->>'organization'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    role = coalesce(excluded.role, public.profiles.role),
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    skill = coalesce(excluded.skill, public.profiles.skill),
    location = coalesce(excluded.location, public.profiles.location),
    organization = coalesce(excluded.organization, public.profiles.organization),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Rebind trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Jobs Table (For Customer Postings & Worker Hires)
create table if not exists public.jobs (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  skill text not null,
  wage numeric not null default 0,
  workers_required integer not null default 1,
  confirmed_workers integer not null default 0,
  location text not null,
  date text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.jobs enable row level security;

drop policy if exists "Authenticated users can read jobs" on public.jobs;
drop policy if exists "Customers can create jobs" on public.jobs;
drop policy if exists "Customers can update their own jobs" on public.jobs;

create policy "Authenticated users can read jobs"
  on public.jobs for select to authenticated using (true);

create policy "Customers can create jobs"
  on public.jobs for insert to authenticated with check (auth.uid() = customer_id);

create policy "Customers can update their own jobs"
  on public.jobs for update to authenticated using (auth.uid() = customer_id);

-- 6. Helper index for faster lookups
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_jobs_customer on public.jobs(customer_id);

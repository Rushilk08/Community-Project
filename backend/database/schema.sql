-- ==============================================================================
-- WorkLink - Supabase PostgreSQL Database Schema
-- Production Schema with RLS, Atomic Dispatch Safeguards & Legal Compliance
-- ==============================================================================
-- HOW TO RUN:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/_/sql
-- 2. Click "New Query", paste this entire script, and click "Run".
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ==============================================================================
-- A. PROFILES TABLE (Customers & Workers)
-- ==============================================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text not null,
  phone text,
  role text not null check (role in ('customer', 'worker')),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'kn', 'hi')),
  adult_eligibility_confirmed boolean not null default false,
  terms_accepted_at timestamp with time zone,
  privacy_notice_acknowledged_at timestamp with time zone,
  
  -- Backward-compatibility fields for teammate frontend
  skill text,
  location text default 'Bengaluru, Karnataka',
  organization text,
  avatar_url text,
  is_available boolean default true,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- B. WORKER PROFILES TABLE (Worker Geo, Skills, and Availability)
-- ==============================================================================
create table if not exists public.worker_profiles (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  skills text[] not null default array['General Labour']::text[],
  expected_wage numeric not null default 0 check (expected_wage >= 0),
  is_available boolean not null default true,
  latitude double precision,
  longitude double precision,
  location_updated_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- C. JOBS TABLE (Customer Job Requests)
-- ==============================================================================
create table if not exists public.jobs (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  required_skill text not null,
  workers_needed integer not null check (workers_needed > 0),
  wage_per_worker numeric not null check (wage_per_worker > 0),
  job_date date not null,
  start_time text default '09:00',
  duration_hours numeric default 8 check (duration_hours > 0),
  worksite_address text not null,
  latitude double precision,
  longitude double precision,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  confirmed_workers integer not null default 0 check (confirmed_workers >= 0),
  
  -- Aliases/Compatibility with frontend existing fields
  skill text,
  wage numeric,
  workers_required integer,
  location text,
  date text,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger to keep compatibility columns in sync for jobs
create or replace function public.sync_job_compatibility_fields()
returns trigger as $$
begin
  if new.required_skill is null and new.skill is not null then
    new.required_skill := new.skill;
  elsif new.skill is null and new.required_skill is not null then
    new.skill := new.required_skill;
  end if;

  if new.workers_needed is null and new.workers_required is not null then
    new.workers_needed := new.workers_required;
  elsif new.workers_required is null and new.workers_needed is not null then
    new.workers_required := new.workers_needed;
  end if;

  if new.wage_per_worker is null and new.wage is not null then
    new.wage_per_worker := new.wage;
  elsif new.wage is null and new.wage_per_worker is not null then
    new.wage := new.wage_per_worker;
  end if;

  if new.worksite_address is null and new.location is not null then
    new.worksite_address := new.location;
  elsif new.location is null and new.worksite_address is not null then
    new.location := new.worksite_address;
  end if;

  if new.job_date is null and new.date is not null then
    begin
      new.job_date := new.date::date;
    exception when others then
      new.job_date := current_date;
    end;
  elsif new.date is null and new.job_date is not null then
    new.date := new.job_date::text;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_jobs on public.jobs;
create trigger trg_sync_jobs
  before insert or update on public.jobs
  for each row execute procedure public.sync_job_compatibility_fields();

-- ==============================================================================
-- D. JOB OFFERS TABLE (Dispatched Offers to Workers)
-- ==============================================================================
create table if not exists public.job_offers (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired')),
  distance_km numeric,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- E. BOOKINGS TABLE (Confirmed Matches & Worksite Records)
-- ==============================================================================
create table if not exists public.bookings (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  agreed_wage numeric not null check (agreed_wage > 0),
  status text not null default 'confirmed' check (status in ('confirmed', 'in_progress', 'completed', 'cancelled')),
  confirmed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Database safeguard: One worker cannot be booked twice for the same job
  constraint unique_worker_job_booking unique (job_id, worker_id)
);

-- Worker overtime and leave requests for individual bookings
create table if not exists public.worker_requests (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references public.bookings(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  request_type text not null check (request_type in ('overtime_pay', 'leave')),
  requested_extra_pay numeric check (requested_extra_pay is null or requested_extra_pay > 0),
  leave_date date,
  reason text not null check (length(btrim(reason)) between 5 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  resolved_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint worker_request_type_fields check (
    (request_type = 'overtime_pay' and requested_extra_pay is not null and leave_date is null) or
    (request_type = 'leave' and requested_extra_pay is null and leave_date is not null)
  )
);

-- ==============================================================================
-- F. WORKER GROUPS TABLE
-- ==============================================================================
create table if not exists public.worker_groups (
  id uuid default gen_random_uuid() primary key,
  group_name text not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- G. GROUP MEMBERS TABLE
-- ==============================================================================
create table if not exists public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.worker_groups(id) on delete cascade not null,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  invitation_status text not null default 'pending' check (invitation_status in ('pending', 'accepted', 'rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_group_member unique (group_id, worker_id)
);

-- ==============================================================================
-- H. REPORTS TABLE (Safety, Wage Disputes, Exploitation Flags)
-- ==============================================================================
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  reported_by uuid references public.profiles(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'under_review', 'resolved', 'dismissed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- I. AUDIT LOGS TABLE
-- ==============================================================================
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- INDEXES FOR FAST DISPATCH & MATCHING
-- ==============================================================================
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_worker_profiles_available on public.worker_profiles(is_available);
create index if not exists idx_worker_profiles_location on public.worker_profiles(latitude, longitude) where is_available = true;
create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_jobs_customer on public.jobs(customer_id);
create index if not exists idx_job_offers_worker_pending on public.job_offers(worker_id, status);
create index if not exists idx_job_offers_job on public.job_offers(job_id);
create index if not exists idx_bookings_job on public.bookings(job_id);
create index if not exists idx_bookings_worker on public.bookings(worker_id);
create index if not exists idx_worker_requests_job_created
  on public.worker_requests(job_id, created_at desc);
create unique index if not exists idx_worker_requests_one_pending_per_type
  on public.worker_requests(booking_id, request_type) where status = 'pending';

-- ==============================================================================
-- AUTH TRIGGER: AUTO PROFILE CREATION & WORKER PROFILE SYNC
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_role text;
  v_skill text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'customer');
  v_skill := new.raw_user_meta_data->>'skill';

  insert into public.profiles (
    id,
    email,
    role,
    full_name,
    phone,
    skill,
    location,
    organization,
    preferred_language,
    adult_eligibility_confirmed,
    terms_accepted_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    v_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'User'), '@', 1)),
    new.raw_user_meta_data->>'phone',
    v_skill,
    coalesce(new.raw_user_meta_data->>'location', 'Bengaluru, Karnataka'),
    new.raw_user_meta_data->>'organization',
    coalesce(new.raw_user_meta_data->>'preferred_language', 'en'),
    coalesce((new.raw_user_meta_data->>'adult_eligibility_confirmed')::boolean, true),
    now()
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

  -- If worker, ensure worker_profiles row exists
  if v_role = 'worker' then
    insert into public.worker_profiles (
      user_id,
      skills,
      is_available
    )
    values (
      new.id,
      case 
        when v_skill is not null and v_skill != '' then array[v_skill]::text[]
        else array['General Labour']::text[]
      end,
      true
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==============================================================================
-- ATOMIC DATABASE DISPATCH FUNCTION: ACCEPT JOB OFFER
-- Prevents overbooking, race conditions, and duplicate booking atomically
-- ==============================================================================
create or replace function public.accept_job_offer(
  p_offer_id uuid,
  p_worker_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_offer record;
  v_job record;
  v_booking_id uuid;
  v_confirmed_count int;
begin
  -- 1. Fetch offer and lock it for update
  select * into v_offer
  from public.job_offers
  where id = p_offer_id and worker_id = p_worker_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error_code', 'OFFER_NOT_FOUND',
      'message', 'Job offer not found or unauthorized'
    );
  end if;

  if v_offer.status != 'pending' then
    return jsonb_build_object(
      'success', false,
      'error_code', 'OFFER_ALREADY_PROCESSED',
      'message', 'Offer is no longer pending (already ' || v_offer.status || ')'
    );
  end if;

  if v_offer.expires_at < now() then
    update public.job_offers set status = 'expired', updated_at = now() where id = p_offer_id;
    return jsonb_build_object(
      'success', false,
      'error_code', 'OFFER_EXPIRED',
      'message', 'Job offer has expired'
    );
  end if;

  -- 2. Fetch job and lock it for update
  select * into v_job
  from public.jobs
  where id = v_offer.job_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error_code', 'JOB_NOT_FOUND',
      'message', 'Associated job not found'
    );
  end if;

  if v_job.status in ('completed', 'cancelled') then
    return jsonb_build_object(
      'success', false,
      'error_code', 'JOB_INACTIVE',
      'message', 'Job is no longer open for acceptance'
    );
  end if;

  -- 3. Calculate current confirmed count
  select count(*) into v_confirmed_count
  from public.bookings
  where job_id = v_job.id and status = 'confirmed';

  if v_confirmed_count >= v_job.workers_needed then
    -- Capacity reached! Expire this offer to safeguard against overbooking
    update public.job_offers set status = 'expired', updated_at = now() where id = p_offer_id;
    return jsonb_build_object(
      'success', false,
      'error_code', 'JOB_FULL',
      'message', 'All positions for this job have already been filled'
    );
  end if;

  -- 4. Guard against duplicate booking
  if exists (select 1 from public.bookings where job_id = v_job.id and worker_id = p_worker_id) then
    return jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_BOOKED',
      'message', 'Worker is already confirmed for this job'
    );
  end if;

  -- 5. Mark offer as accepted
  update public.job_offers
  set status = 'accepted', updated_at = now()
  where id = p_offer_id;

  -- 6. Insert atomic booking record
  insert into public.bookings (
    job_id,
    worker_id,
    agreed_wage,
    status,
    confirmed_at
  )
  values (
    v_job.id,
    p_worker_id,
    v_job.wage_per_worker,
    'confirmed',
    now()
  )
  returning id into v_booking_id;

  -- 7. Update confirmed workers count and job status
  v_confirmed_count := v_confirmed_count + 1;
  update public.jobs
  set
    confirmed_workers = v_confirmed_count,
    status = case when v_confirmed_count >= workers_needed then 'in_progress' else status end,
    updated_at = now()
  where id = v_job.id;

  -- 8. Audit log for legal record
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    p_worker_id,
    'BOOKING_CONFIRMED',
    'booking',
    v_booking_id::text,
    jsonb_build_object(
      'job_id', v_job.id,
      'offer_id', p_offer_id,
      'agreed_wage', v_job.wage_per_worker,
      'confirmed_workers', v_confirmed_count,
      'workers_needed', v_job.workers_needed
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Offer accepted and booking confirmed successfully',
    'booking_id', v_booking_id,
    'job_id', v_job.id,
    'agreed_wage', v_job.wage_per_worker,
    'confirmed_workers', v_confirmed_count,
    'workers_needed', v_job.workers_needed
  );
end;
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_offers enable row level security;
alter table public.bookings enable row level security;
alter table public.worker_requests enable row level security;
alter table public.worker_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: Authenticated users can read basic profiles
drop policy if exists "Authenticated read profiles" on public.profiles;
create policy "Authenticated read profiles" on public.profiles
  for select to authenticated using (true);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- Worker Profiles: Workers manage own profile; customers can only query available worker counts
drop policy if exists "Worker manage own profile" on public.worker_profiles;
create policy "Worker manage own profile" on public.worker_profiles
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Jobs: Authenticated can read jobs; Customers insert/update own jobs
drop policy if exists "Authenticated read jobs" on public.jobs;
create policy "Authenticated read jobs" on public.jobs
  for select to authenticated using (true);

drop policy if exists "Customer create jobs" on public.jobs;
create policy "Customer create jobs" on public.jobs
  for insert to authenticated with check (auth.uid() = customer_id);

drop policy if exists "Customer update own jobs" on public.jobs;
create policy "Customer update own jobs" on public.jobs
  for update to authenticated using (auth.uid() = customer_id);

-- Job Offers: Workers only see their own offers; Customers see offers for their jobs
drop policy if exists "Worker read own offers" on public.job_offers;
create policy "Worker read own offers" on public.job_offers
  for select to authenticated using (
    auth.uid() = worker_id or
    auth.uid() in (select customer_id from public.jobs where jobs.id = job_offers.job_id)
  );

-- Bookings: Only involved worker and customer can view booking
drop policy if exists "Booking participants read bookings" on public.bookings;
create policy "Booking participants read bookings" on public.bookings
  for select to authenticated using (
    auth.uid() = worker_id or
    auth.uid() in (select customer_id from public.jobs where jobs.id = bookings.job_id)
  );

drop policy if exists "Booking participants read worker requests" on public.worker_requests;
create policy "Booking participants read worker requests" on public.worker_requests
  for select to authenticated using (
    auth.uid() = worker_id or auth.uid() = customer_id
  );

-- Reports: Users insert reports and view their own reports
drop policy if exists "Users insert reports" on public.reports;
create policy "Users insert reports" on public.reports
  for insert to authenticated with check (auth.uid() = reported_by);

drop policy if exists "Users read own reports" on public.reports;
create policy "Users read own reports" on public.reports
  for select to authenticated using (auth.uid() = reported_by);

-- Audit logs: Read restricted to server role
drop policy if exists "Audit logs read restriction" on public.audit_logs;
create policy "Audit logs read restriction" on public.audit_logs
  for select to authenticated using (auth.uid() = actor_id);

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

alter table public.profiles add column if not exists preferred_language text not null default 'en';
alter table public.profiles add column if not exists adult_eligibility_confirmed boolean not null default false;
alter table public.profiles add column if not exists terms_accepted_at timestamp with time zone;
alter table public.profiles add column if not exists privacy_notice_acknowledged_at timestamp with time zone;
alter table public.profiles add column if not exists skill text;
alter table public.profiles add column if not exists location text default 'Bengaluru, Karnataka';
alter table public.profiles add column if not exists organization text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists is_available boolean default true;

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

alter table public.jobs add column if not exists required_skill text;
alter table public.jobs add column if not exists workers_needed integer default 1;
alter table public.jobs add column if not exists wage_per_worker numeric default 0;
alter table public.jobs add column if not exists job_date date default current_date;
alter table public.jobs add column if not exists start_time text default '09:00';
alter table public.jobs add column if not exists duration_hours numeric default 8;
alter table public.jobs add column if not exists worksite_address text;
alter table public.jobs add column if not exists latitude double precision;
alter table public.jobs add column if not exists longitude double precision;
alter table public.jobs add column if not exists skill text;
alter table public.jobs add column if not exists wage numeric;
alter table public.jobs add column if not exists workers_required integer;
alter table public.jobs add column if not exists location text;
alter table public.jobs add column if not exists date text;

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
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Database safeguard: One worker cannot be booked twice for the same job
  constraint unique_worker_job_booking unique (job_id, worker_id)
);

alter table public.bookings add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

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


-- ==============================================================================
-- J. WORKER REFERRALS TABLE (Recommend Someone to Fill Vacancies)
-- ==============================================================================
create table if not exists public.worker_referrals (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  referring_worker_id uuid references public.profiles(id) on delete cascade not null,
  candidate_name text not null,
  candidate_phone text not null,
  candidate_skills text not null,
  experience text,
  location text,
  notes text,
  consent_confirmed boolean not null default true,
  registered_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'invited', 'registered', 'accepted', 'rejected', 'expired')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_candidate_per_job unique (job_id, candidate_phone)
);

-- ==============================================================================
-- K. LEAVE APPLICATIONS TABLE (Multi-day & Emergency Leave Management)
-- ==============================================================================
create table if not exists public.leave_applications (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  booking_id uuid references public.bookings(id) on delete cascade not null,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  start_date date not null,
  end_date date not null,
  reason text not null check (length(btrim(reason)) >= 3),
  description text,
  is_emergency boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  review_notes text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint check_leave_dates check (end_date >= start_date)
);

-- ==============================================================================
-- L. JOB CANCELLATION REQUESTS TABLE (Customer-Approval Gated)
-- ==============================================================================
create table if not exists public.job_cancellation_requests (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references public.bookings(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  reason text not null check (length(btrim(reason)) >= 3),
  explanation text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resolved_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index if not exists idx_cancellation_pending_booking
  on public.job_cancellation_requests(booking_id) where status = 'pending';

-- ==============================================================================
-- M. WORKER REVIEWS TABLE (5-Category Verified Rating & Feedback)
-- ==============================================================================
create table if not exists public.worker_reviews (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  booking_id uuid references public.bookings(id) on delete cascade not null,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  punctuality_rating integer not null check (punctuality_rating between 1 and 5),
  quality_rating integer not null check (quality_rating between 1 and 5),
  professionalism_rating integer not null check (professionalism_rating between 1 and 5),
  reliability_rating integer not null check (reliability_rating between 1 and 5),
  communication_rating integer not null check (communication_rating between 1 and 5),
  overall_rating numeric not null check (overall_rating between 1.0 and 5.0),
  review_text text,
  is_reported boolean not null default false,
  report_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_worker_review_per_job unique (job_id, worker_id)
);

-- ==============================================================================
-- N. EMERGENCY WORKER REPLACEMENT & INVITATIONS
-- ==============================================================================
create table if not exists public.emergency_replacements (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  original_worker_id uuid references public.profiles(id) on delete set null,
  original_booking_id uuid references public.bookings(id) on delete set null,
  trigger_reason text not null check (trigger_reason in ('approved_leave', 'emergency_unavailability', 'approved_cancellation', 'no_show', 'other')),
  replacement_date date not null,
  start_time text default '09:00',
  duration_hours numeric default 8 check (duration_hours > 0),
  required_skill text not null,
  workers_needed integer not null default 1 check (workers_needed > 0),
  additional_notes text,
  status text not null default 'searching' check (status in ('searching', 'invitations_sent', 'worker_interested', 'pending_customer_confirmation', 'confirmed', 'unavailable', 'cancelled')),
  confirmed_worker_id uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.emergency_replacements alter column original_worker_id drop not null;

create table if not exists public.replacement_invitations (
  id uuid default gen_random_uuid() primary key,
  replacement_id uuid references public.emergency_replacements(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  worker_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_worker_per_replacement unique (replacement_id, worker_id)
);

-- ==============================================================================
-- O. NOTIFICATIONS TABLE
-- ==============================================================================
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  message text not null,
  type text not null default 'general',
  data jsonb default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_notifications_user_unread on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_referrals_job on public.worker_referrals(job_id);
create index if not exists idx_referrals_worker on public.worker_referrals(referring_worker_id);
create index if not exists idx_leaves_worker on public.leave_applications(worker_id);
create index if not exists idx_leaves_job on public.leave_applications(job_id);
create index if not exists idx_cancellations_booking on public.job_cancellation_requests(booking_id);
create index if not exists idx_cancellations_job on public.job_cancellation_requests(job_id);
create index if not exists idx_reviews_worker on public.worker_reviews(worker_id);
create index if not exists idx_replacements_job on public.emergency_replacements(job_id);
create index if not exists idx_replacement_invitations_worker on public.replacement_invitations(worker_id);


-- ==============================================================================
-- P. PERMISSIONS & ROLE GRANTS (service_role, authenticated, anon)
-- ==============================================================================
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all privileges on all tables in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all routines in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to postgres, anon, authenticated, service_role;

-- Reload PostgREST schema cache so newly created tables/columns are immediately visible
notify pgrst, 'reload schema';

create extension if not exists pgcrypto;

create table if not exists public.departments (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    created_at timestamptz not null default now()
);

insert into public.departments (name)
values ('Admin'), ('Sales'), ('Development'), ('IT Support')
on conflict (name) do nothing;

create table if not exists public.customers (
    id uuid primary key default gen_random_uuid(),
    owner_user_id uuid unique references auth.users (id) on delete set null,
    contact_name text not null,
    company_name text not null,
    email text not null,
    phone text,
    status text not null default 'Active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    customer_id uuid unique references public.customers (id) on delete set null,
    login_id text unique,
    full_name text not null,
    email text not null,
    phone text,
    role text not null default 'customer'
        check (role in ('admin', 'employee', 'customer')),
    department_id uuid references public.departments (id) on delete set null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.leads (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid references public.customers (id) on delete set null,
    contact_name text not null,
    company_name text not null,
    service text not null,
    source text not null default 'Other',
    status text not null default 'New',
    assigned_to uuid references public.profiles (user_id) on delete set null,
    followup_at date,
    notes text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references public.customers (id) on delete cascade,
    name text not null,
    service text not null,
    assigned_to uuid references public.profiles (user_id) on delete set null,
    status text not null default 'Not Started',
    priority text not null default 'Medium',
    deadline date,
    progress integer not null default 0 check (progress between 0 and 100),
    updates text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references public.customers (id) on delete cascade,
    subject text not null,
    priority text not null default 'Medium',
    assigned_to uuid references public.profiles (user_id) on delete set null,
    status text not null default 'New',
    due_at date,
    latest_update text,
    notes text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    department_id uuid references public.departments (id) on delete set null,
    assigned_to uuid references public.profiles (user_id) on delete set null,
    related_reference text,
    priority text not null default 'Medium',
    due_at date,
    status text not null default 'Pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.service_requests (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references public.customers (id) on delete cascade,
    service text not null,
    description text not null,
    contact_method text not null,
    status text not null default 'Submitted',
    assigned_to uuid references public.profiles (user_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.issues (
    id uuid primary key default gen_random_uuid(),
    reporter_user_id uuid not null references public.profiles (user_id) on delete cascade,
    subject text not null,
    description text not null,
    status text not null default 'New',
    assigned_to uuid references public.profiles (user_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_user_id uuid references public.profiles (user_id) on delete cascade,
    message text not null,
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists leads_customer_id_idx on public.leads (customer_id);
create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
create index if not exists projects_customer_id_idx on public.projects (customer_id);
create index if not exists tickets_customer_id_idx on public.tickets (customer_id);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);
create index if not exists service_requests_customer_id_idx on public.service_requests (customer_id);
create index if not exists notifications_recipient_created_idx
    on public.notifications (recipient_user_id, created_at desc);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select p.role
    from public.profiles as p
    where p.user_id = (select auth.uid())
      and p.active = true
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(public.current_app_role() in ('admin', 'employee'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(public.current_app_role() = 'admin', false)
$$;

create or replace function public.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select p.customer_id
    from public.profiles as p
    where p.user_id = (select auth.uid())
      and p.active = true
      and p.role = 'customer'
$$;

create or replace function public.bootstrap_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_customer_id uuid;
    v_name text;
    v_company text;
begin
    v_name := coalesce(
        nullif(new.raw_user_meta_data ->> 'full_name', ''),
        split_part(new.email, '@', 1)
    );
    v_company := nullif(new.raw_user_meta_data ->> 'company_name', '');

    if v_company is not null then
        insert into public.customers (
            owner_user_id,
            contact_name,
            company_name,
            email,
            phone
        )
        values (
            new.id,
            v_name,
            v_company,
            new.email,
            nullif(new.raw_user_meta_data ->> 'phone', '')
        )
        returning id into v_customer_id;
    end if;

    insert into public.profiles (
        user_id,
        customer_id,
        full_name,
        email,
        phone,
        role
    )
    values (
        new.id,
        v_customer_id,
        v_name,
        new.email,
        nullif(new.raw_user_meta_data ->> 'phone', ''),
        'customer'
    );

    return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.bootstrap_auth_user();

drop trigger if exists set_updated_at on public.customers;
create trigger set_updated_at before update on public.customers
for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.leads;
create trigger set_updated_at before update on public.leads
for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.projects;
create trigger set_updated_at before update on public.projects
for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.tickets;
create trigger set_updated_at before update on public.tickets
for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.tasks;
create trigger set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.service_requests;
create trigger set_updated_at before update on public.service_requests
for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.issues;
create trigger set_updated_at before update on public.issues
for each row execute function public.set_updated_at();

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.leads enable row level security;
alter table public.projects enable row level security;
alter table public.tickets enable row level security;
alter table public.tasks enable row level security;
alter table public.service_requests enable row level security;
alter table public.issues enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Authenticated users can read departments" on public.departments;
create policy "Authenticated users can read departments"
on public.departments for select to authenticated
using (true);

drop policy if exists "Admins manage departments" on public.departments;
create policy "Admins manage departments"
on public.departments for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Users and staff read profiles" on public.profiles;
create policy "Users and staff read profiles"
on public.profiles for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_staff()));

drop policy if exists "Users update own basic profile" on public.profiles;
create policy "Users update own basic profile"
on public.profiles for update to authenticated
using (
    user_id = (select auth.uid())
    and role = (select public.current_app_role())
)
with check (
    user_id = (select auth.uid())
    and role = (select public.current_app_role())
);

drop policy if exists "Admins manage profiles" on public.profiles;
create policy "Admins manage profiles"
on public.profiles for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Staff and owners read customers" on public.customers;
create policy "Staff and owners read customers"
on public.customers for select to authenticated
using (
    (select public.is_staff())
    or owner_user_id = (select auth.uid())
);

drop policy if exists "Staff manage customers" on public.customers;
create policy "Staff manage customers"
on public.customers for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists "Staff and related customers read leads" on public.leads;
create policy "Staff and related customers read leads"
on public.leads for select to authenticated
using (
    (select public.is_staff())
    or customer_id = (select public.current_customer_id())
);

drop policy if exists "Staff manage leads" on public.leads;
create policy "Staff manage leads"
on public.leads for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists "Staff and related customers read projects" on public.projects;
create policy "Staff and related customers read projects"
on public.projects for select to authenticated
using (
    (select public.is_staff())
    or customer_id = (select public.current_customer_id())
);

drop policy if exists "Staff manage projects" on public.projects;
create policy "Staff manage projects"
on public.projects for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists "Staff and related customers read tickets" on public.tickets;
create policy "Staff and related customers read tickets"
on public.tickets for select to authenticated
using (
    (select public.is_staff())
    or customer_id = (select public.current_customer_id())
);

drop policy if exists "Customers create own tickets" on public.tickets;
create policy "Customers create own tickets"
on public.tickets for insert to authenticated
with check (
    customer_id = (select public.current_customer_id())
    and status = 'New'
    and assigned_to is null
);

drop policy if exists "Staff manage tickets" on public.tickets;
create policy "Staff manage tickets"
on public.tickets for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists "Staff manage tasks" on public.tasks;
create policy "Staff manage tasks"
on public.tasks for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists "Staff and related customers read service requests" on public.service_requests;
create policy "Staff and related customers read service requests"
on public.service_requests for select to authenticated
using (
    (select public.is_staff())
    or customer_id = (select public.current_customer_id())
);

drop policy if exists "Customers create own service requests" on public.service_requests;
create policy "Customers create own service requests"
on public.service_requests for insert to authenticated
with check (
    customer_id = (select public.current_customer_id())
    and status = 'Submitted'
    and assigned_to is null
);

drop policy if exists "Staff manage service requests" on public.service_requests;
create policy "Staff manage service requests"
on public.service_requests for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists "Users and staff read issues" on public.issues;
create policy "Users and staff read issues"
on public.issues for select to authenticated
using (
    (select public.is_staff())
    or reporter_user_id = (select auth.uid())
);

drop policy if exists "Users create own issues" on public.issues;
create policy "Users create own issues"
on public.issues for insert to authenticated
with check (
    reporter_user_id = (select auth.uid())
    and status = 'New'
    and assigned_to is null
);

drop policy if exists "Staff manage issues" on public.issues;
create policy "Staff manage issues"
on public.issues for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications"
on public.notifications for select to authenticated
using (
    recipient_user_id = (select auth.uid())
    or (select public.is_staff())
);

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
on public.notifications for update to authenticated
using (recipient_user_id = (select auth.uid()))
with check (recipient_user_id = (select auth.uid()));

drop policy if exists "Staff manage notifications" on public.notifications;
create policy "Staff manage notifications"
on public.notifications for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

grant usage on schema public to authenticated;
grant select on public.departments to authenticated;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, updated_at) on public.profiles to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.tickets to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.service_requests to authenticated;
grant select, insert, update, delete on public.issues to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;

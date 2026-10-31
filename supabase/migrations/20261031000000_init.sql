-- MapInter — schéma initial
-- Events (zone délimitée), calques, points d'intérêt, ancres QR "Vous êtes ici", annonces live.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  -- Zone délimitée (bounding box WGS84)
  min_lng double precision not null check (min_lng between -180 and 180),
  min_lat double precision not null check (min_lat between -90 and 90),
  max_lng double precision not null check (max_lng between -180 and 180),
  max_lat double precision not null check (max_lat between -90 and 90),
  zone extensions.geometry(Polygon, 4326)
    generated always as (extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)) stored,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_lng < max_lng and min_lat < max_lat),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index events_owner_idx on public.events (owner_id);
create index events_zone_idx on public.events using gist (zone);

-- ---------------------------------------------------------------------------
-- Calques : image uploadée et calée, ou plan dessiné dans l'éditeur
-- ---------------------------------------------------------------------------
create table public.layers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('image', 'drawn')),
  name text not null default 'Plan',
  -- kind = 'image' : chemin dans le bucket "layers" + 4 coins [lng, lat]
  -- dans l'ordre haut-gauche, haut-droite, bas-droite, bas-gauche (format MapLibre)
  image_path text,
  corners jsonb,
  -- kind = 'drawn' : FeatureCollection GeoJSON (halls, allées, stands…)
  features jsonb,
  opacity real not null default 1 check (opacity between 0 and 1),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'image' or (image_path is not null and corners is not null)),
  check (kind <> 'drawn' or features is not null)
);

create index layers_event_idx on public.layers (event_id);

-- ---------------------------------------------------------------------------
-- Points d'intérêt
-- ---------------------------------------------------------------------------
create table public.pois (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  category text not null default 'stand'
    check (category in ('stand', 'stage', 'room', 'food', 'toilet', 'info', 'first_aid', 'entrance', 'exit', 'other')),
  name text not null,
  code text, -- ex : "B12"
  description text,
  lng double precision not null check (lng between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  geom extensions.geometry(Point, 4326)
    generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)) stored,
  status text not null default 'open' check (status in ('open', 'busy', 'closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pois_event_idx on public.pois (event_id);
create index pois_geom_idx on public.pois using gist (geom);

-- ---------------------------------------------------------------------------
-- Ancres QR "Vous êtes ici"
-- ---------------------------------------------------------------------------
create table public.anchors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  label text not null,
  lng double precision not null check (lng between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  created_at timestamptz not null default now()
);

create index anchors_event_idx on public.anchors (event_id);

-- ---------------------------------------------------------------------------
-- Annonces live
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  level text not null default 'info' check (level in ('info', 'warning', 'alert')),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index announcements_event_idx on public.announcements (event_id);

-- ---------------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger layers_updated_at before update on public.layers
  for each row execute function public.set_updated_at();
create trigger pois_updated_at before update on public.pois
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
create function public.is_event_owner(eid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = eid and e.owner_id = auth.uid());
$$;

create function public.is_event_visible(eid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = eid and (e.is_published or e.owner_id = auth.uid())
  );
$$;

alter table public.events enable row level security;
alter table public.layers enable row level security;
alter table public.pois enable row level security;
alter table public.anchors enable row level security;
alter table public.announcements enable row level security;

create policy "events: lecture publique si publié, sinon propriétaire"
  on public.events for select using (is_published or owner_id = auth.uid());
create policy "events: création par soi-même"
  on public.events for insert to authenticated with check (owner_id = auth.uid());
create policy "events: modification par le propriétaire"
  on public.events for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "events: suppression par le propriétaire"
  on public.events for delete to authenticated using (owner_id = auth.uid());

-- Tables enfants : lecture si l'event est visible, écriture si propriétaire
do $$
declare t text;
begin
  foreach t in array array['layers', 'pois', 'anchors', 'announcements'] loop
    execute format(
      'create policy "%1$s: lecture" on public.%1$I for select using (public.is_event_visible(event_id))', t);
    execute format(
      'create policy "%1$s: écriture" on public.%1$I for all to authenticated
         using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime (mises à jour live côté visiteur)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.pois, public.announcements, public.layers;

-- ---------------------------------------------------------------------------
-- Storage : bucket des calques (lecture publique, écriture par le propriétaire)
-- Chemin des fichiers : <event_id>/<nom-fichier>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('layers', 'layers', true, 20971520, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Vrai si l'objet est dans le dossier d'un event appartenant à l'utilisateur.
-- Le dossier est vérifié avant le cast pour ne jamais lever d'erreur sur un nom inattendu.
create function public.owns_layer_object(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare folder text := (storage.foldername(object_name))[1];
begin
  if folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_event_owner(folder::uuid);
end;
$$;

create policy "layers bucket: lecture par le propriétaire"
  on storage.objects for select to authenticated
  using (bucket_id = 'layers' and public.owns_layer_object(name));
create policy "layers bucket: upload par le propriétaire"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'layers' and public.owns_layer_object(name));
create policy "layers bucket: modification par le propriétaire"
  on storage.objects for update to authenticated
  using (bucket_id = 'layers' and public.owns_layer_object(name));
create policy "layers bucket: suppression par le propriétaire"
  on storage.objects for delete to authenticated
  using (bucket_id = 'layers' and public.owns_layer_object(name));

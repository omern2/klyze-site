-- ============================================================
-- Klyze.gg site baglantisi — Supabase Dashboard > SQL Editor'de
-- BIR KEZ calistir (idempotent: tekrar calistirmak zararsiz).
-- Sitede giris yapan kullanicilarin Google ismi + fotografi kullanilir.
-- ============================================================

-- 0) ADMIN KONTROL FONKSIYONU (RLS ozyinelemesini onler)
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.site_admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- 1) YORUMLAR
create table if not exists public.site_reviews (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 24),
  stars smallint not null check (stars between 1 and 5),
  text text not null check (char_length(text) between 1 and 400),
  avatar_url text check (char_length(avatar_url) <= 500),
  lang text not null default 'tr' check (lang in ('tr', 'en')),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.site_reviews enable row level security;

drop policy if exists "site_reviews_select_all" on public.site_reviews;
create policy "site_reviews_select_all"
  on public.site_reviews for select
  using (is_hidden = false);

drop policy if exists "site_reviews_insert_all" on public.site_reviews;
create policy "site_reviews_insert_all"
  on public.site_reviews for insert
  with check (
    char_length(name) between 1 and 24
    and stars between 1 and 5
    and char_length(text) between 1 and 400
    and lang in ('tr', 'en')
  );

-- 2) BEGENILER (her tarayici basina 1 oy; voter_key tarayicida saklanir)
create table if not exists public.site_review_likes (
  id bigint generated always as identity primary key,
  review_id bigint not null references public.site_reviews(id) on delete cascade,
  voter_key text not null check (char_length(voter_key) between 8 and 128),
  created_at timestamptz not null default now(),
  constraint site_review_likes_unique_vote unique (review_id, voter_key)
);

alter table public.site_review_likes enable row level security;

drop policy if exists "site_review_likes_select_all" on public.site_review_likes;
create policy "site_review_likes_select_all"
  on public.site_review_likes for select
  using (true);

drop policy if exists "site_review_likes_insert_all" on public.site_review_likes;
create policy "site_review_likes_insert_all"
  on public.site_review_likes for insert
  with check (char_length(voter_key) between 8 and 128);

-- 3) YORUM YANITLARI
create table if not exists public.site_review_replies (
  id bigint generated always as identity primary key,
  review_id bigint not null references public.site_reviews(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  text text not null check (char_length(text) between 1 and 200),
  avatar_url text check (char_length(avatar_url) <= 500),
  lang text not null default 'tr' check (lang in ('tr', 'en')),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.site_review_replies enable row level security;

drop policy if exists "site_review_replies_select_all" on public.site_review_replies;
create policy "site_review_replies_select_all"
  on public.site_review_replies for select
  using (is_hidden = false);

drop policy if exists "site_review_replies_insert_all" on public.site_review_replies;
create policy "site_review_replies_insert_all"
  on public.site_review_replies for insert
  with check (
    char_length(name) between 1 and 24
    and char_length(text) between 1 and 200
    and lang in ('tr', 'en')
  );

-- Spam gizleme (silmeden): Dashboard > Table Editor
-- update public.site_reviews set is_hidden = true where id = 123;
-- update public.site_review_replies set is_hidden = true where id = 123;

-- ============================================================
-- 4) ADMIN KAYDI
-- ============================================================

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rol text not null default 'admin' check (rol in ('admin','sahip')),
  ad text check (char_length(ad) <= 24),
  avatar_url text check (char_length(avatar_url) <= 500),
  created_at timestamptz not null default now()
);

alter table public.site_admins enable row level security;

drop policy if exists "site_admins_select_own" on public.site_admins;
create policy "site_admins_select_own"
  on public.site_admins for select
  using (user_id = auth.uid());

drop policy if exists "site_admins_select_for_admins" on public.site_admins;
create policy "site_admins_select_for_admins"
  on public.site_admins for select
  using (public.is_admin());

-- Admin yapma (Google ile bir kez giris yaptiktan sonra, e-postayi yaz):
-- insert into public.site_admins (user_id, rol)
-- select id, 'admin' from auth.users where email = 'ornek@gmail.com'
-- on conflict (user_id) do update set rol = 'admin';

-- ============================================================
-- 5) DESTEK TALEPLERI
-- ============================================================

create table if not exists public.destek_talepleri (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  email text not null check (char_length(email) between 3 and 120),
  avatar_url text check (char_length(avatar_url) <= 500),
  kategori text not null default 'diger' check (kategori in ('teknik','hesap','oneri','diger')),
  konu text not null check (char_length(konu) between 3 and 80),
  aciklama text not null check (char_length(aciklama) between 10 and 2000),
  dosyalar text[] not null default '{}',
  durum text not null default 'yeni' check (durum in ('yeni','incelemede','yanitlandi','kapali')),
  oncelik text not null default 'normal' check (oncelik in ('dusuk','normal','yuksek','kritik')),
  atanan_admin uuid references public.site_admins(user_id) on delete set null,
  admin_yanit text check (admin_yanit is null or char_length(admin_yanit) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.destek_talepleri enable row level security;

drop policy if exists "destek_select_own_or_admin" on public.destek_talepleri;
create policy "destek_select_own_or_admin"
  on public.destek_talepleri for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "destek_insert_own" on public.destek_talepleri;
create policy "destek_insert_own"
  on public.destek_talepleri for insert
  with check (user_id = auth.uid()
    and char_length(name) between 1 and 24
    and char_length(email) between 3 and 120
    and kategori in ('teknik','hesap','oneri','diger')
    and char_length(konu) between 3 and 80
    and char_length(aciklama) between 10 and 2000);

drop policy if exists "destek_update_admin" on public.destek_talepleri;
create policy "destek_update_admin"
  on public.destek_talepleri for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 6) DESTEK KONUSMALARI (cift yonlu: kullanici <-> ekip)
-- ============================================================

create table if not exists public.destek_mesajlari (
  id bigint generated always as identity primary key,
  talep_id bigint not null references public.destek_talepleri(id) on delete cascade,
  kim text not null check (kim in ('kullanici','ekip')),
  ad text check (char_length(ad) <= 24),
  avatar_url text check (char_length(avatar_url) <= 500),
  metin text not null check (char_length(metin) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.destek_mesajlari enable row level security;

drop policy if exists "destek_mesaj_select" on public.destek_mesajlari;
create policy "destek_mesaj_select"
  on public.destek_mesajlari for select
  using (exists (select 1 from public.destek_talepleri t
    where t.id = talep_id
    and (t.user_id = auth.uid() or public.is_admin())));

drop policy if exists "destek_mesaj_insert_kullanici" on public.destek_mesajlari;
create policy "destek_mesaj_insert_kullanici"
  on public.destek_mesajlari for insert
  with check (kim = 'kullanici' and exists (select 1 from public.destek_talepleri t
    where t.id = talep_id and t.user_id = auth.uid()));

drop policy if exists "destek_mesaj_insert_ekip" on public.destek_mesajlari;
create policy "destek_mesaj_insert_ekip"
  on public.destek_mesajlari for insert
  with check (kim = 'ekip' and (public.is_sahip() or exists (
    select 1 from public.destek_talepleri t
    where t.id = talep_id and t.atanan_admin = auth.uid()
  )));

-- ============================================================
-- 7) IC NOTLAR (yalnizca ekip) + MEMNUNIYET PUANI (CSAT)
-- ============================================================

create table if not exists public.destek_notlar (
  id bigint generated always as identity primary key,
  talep_id bigint not null references public.destek_talepleri(id) on delete cascade,
  admin_id uuid not null references public.site_admins(user_id) on delete cascade,
  metin text not null check (char_length(metin) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.destek_notlar enable row level security;

drop policy if exists "destek_not_admin_all" on public.destek_notlar;
create policy "destek_not_admin_all"
  on public.destek_notlar for all
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.destek_puan (
  talep_id bigint primary key references public.destek_talepleri(id) on delete cascade,
  puan smallint not null check (puan between 1 and 5),
  yorum text check (yorum is null or char_length(yorum) <= 500),
  created_at timestamptz not null default now()
);

alter table public.destek_puan enable row level security;

drop policy if exists "destek_puan_select" on public.destek_puan;
create policy "destek_puan_select"
  on public.destek_puan for select
  using (exists (select 1 from public.destek_talepleri t
    where t.id = talep_id
    and (t.user_id = auth.uid() or public.is_admin())));

drop policy if exists "destek_puan_insert_own" on public.destek_puan;
create policy "destek_puan_insert_own"
  on public.destek_puan for insert
  with check (puan between 1 and 5 and exists (select 1 from public.destek_talepleri t
    where t.id = talep_id and t.user_id = auth.uid()));

-- ============================================================
-- 8) DOSYA DEPOSU (gorsel/video, 25MB) + GERCEK ZAMANLI YAYIN
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('destek-dosyalari','destek-dosyalari', true, 26214400,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 26214400,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'];

drop policy if exists "destek_dosya_select_all" on storage.objects;
create policy "destek_dosya_select_all"
  on storage.objects for select
  using (bucket_id = 'destek-dosyalari');

drop policy if exists "destek_dosya_insert_auth" on storage.objects;
create policy "destek_dosya_insert_auth"
  on storage.objects for insert
  with check (bucket_id = 'destek-dosyalari' and auth.role() = 'authenticated');

alter publication supabase_realtime add table public.destek_talepleri;
alter publication supabase_realtime add table public.destek_mesajlari;
alter publication supabase_realtime add table public.destek_notlar;
alter publication supabase_realtime add table public.destek_puan;
-- Not: bu 4 satir tablolar yayindaysa 42710 hatasi verir (zararsiz); ilk kurulumda gerekli.

-- ============================================================
-- 9) ROL SISTEMI: destek rolu, beklemede, rozet, olay, davet, log
-- ============================================================

alter table public.site_admins drop constraint if exists site_admins_rol_check;
alter table public.site_admins add constraint site_admins_rol_check
  check (rol in ('admin','sahip','destek'));

alter table public.destek_talepleri drop constraint if exists destek_talepleri_durum_check;
alter table public.destek_talepleri add constraint destek_talepleri_durum_check
  check (durum in ('yeni','beklemede','incelemede','yanitlandi','kapali'));

alter table public.destek_mesajlari
  add column if not exists rol text check (rol in ('user','admin','sahip','destek'));

alter table public.site_reviews
  add column if not exists rol text check (rol in ('user','admin','sahip','destek'));

drop policy if exists "destek_mesaj_insert_kullanici" on public.destek_mesajlari;
create policy "destek_mesaj_insert_kullanici"
  on public.destek_mesajlari for insert
  with check (kim = 'kullanici' and (rol is null or rol = 'user')
    and exists (select 1 from public.destek_talepleri t
      where t.id = talep_id and t.user_id = auth.uid()));

drop policy if exists "site_reviews_insert_all" on public.site_reviews;
create policy "site_reviews_insert_all"
  on public.site_reviews for insert
  with check (
    char_length(name) between 1 and 24
    and stars between 1 and 5
    and char_length(text) between 1 and 400
    and lang in ('tr', 'en')
    and ((rol is null or rol = 'user')
      or (public.is_admin() and rol in ('admin','sahip','destek')))
  );

create or replace function public.is_sahip()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.site_admins where user_id = auth.uid() and rol = 'sahip');
$$;
grant execute on function public.is_sahip() to anon, authenticated;

drop policy if exists "site_admins_update_sahip" on public.site_admins;
create policy "site_admins_update_sahip"
  on public.site_admins for update
  using (public.is_sahip()) with check (public.is_sahip());

drop policy if exists "site_admins_delete_sahip" on public.site_admins;
create policy "site_admins_delete_sahip"
  on public.site_admins for delete
  using (public.is_sahip());

create table if not exists public.ticket_events (
  id bigint generated always as identity primary key,
  talep_id bigint not null references public.destek_talepleri(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_ad text check (char_length(actor_ad) <= 24),
  event_type text not null check (event_type in ('acildi','durum','oncelik','atama','yanit','puan','kapatildi','not')),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.ticket_events enable row level security;

drop policy if exists "ticket_events_select" on public.ticket_events;
create policy "ticket_events_select"
  on public.ticket_events for select
  using (exists (select 1 from public.destek_talepleri t
    where t.id = talep_id
    and (t.user_id = auth.uid() or public.is_admin())));

drop policy if exists "ticket_events_insert" on public.ticket_events;
create policy "ticket_events_insert"
  on public.ticket_events for insert
  with check ((event_type = 'acildi' and exists (select 1 from public.destek_talepleri t
      where t.id = talep_id and t.user_id = auth.uid()))
    or public.is_admin());

create table if not exists public.site_davetler (
  email text primary key check (char_length(email) between 3 and 120),
  rol text not null check (rol in ('admin','sahip','destek')),
  olusturan uuid references public.site_admins(user_id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.site_davetler enable row level security;

drop policy if exists "davet_admin_all" on public.site_davetler;
create policy "davet_admin_all"
  on public.site_davetler for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "davet_select_own" on public.site_davetler;
create policy "davet_select_own"
  on public.site_davetler for select
  using (email = (auth.jwt() ->> 'email'));

drop policy if exists "davet_delete_own" on public.site_davetler;
create policy "davet_delete_own"
  on public.site_davetler for delete
  using (email = (auth.jwt() ->> 'email'));

drop policy if exists "site_admins_insert_davet" on public.site_admins;
create policy "site_admins_insert_davet"
  on public.site_admins for insert
  with check (user_id = auth.uid() and exists (select 1 from public.site_davetler d
    where d.email = (auth.jwt() ->> 'email') and d.rol in ('admin','sahip','destek')));

create table if not exists public.role_assignment_logs (
  id bigint generated always as identity primary key,
  hedef_email text not null,
  hedef_uid uuid,
  eski_rol text,
  yeni_rol text not null,
  islem text not null check (islem in ('davet','rol_degisikligi','kaldirma')),
  yapan_admin uuid references public.site_admins(user_id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.role_assignment_logs enable row level security;

drop policy if exists "role_log_admin" on public.role_assignment_logs;
create policy "role_log_admin"
  on public.role_assignment_logs for all
  using (public.is_admin()) with check (public.is_admin());

alter publication supabase_realtime add table public.ticket_events;

-- ============================================================
-- 10) DESTEK V2: Discord mantigi — havuz + ustlenme + cozuldu
-- Dashboard > SQL Editor'de BIR KEZ calistir (idempotent).
-- - durum: 'kapali' kaldirildi, tek etiket 'cozuldu' geldi.
-- - Havuz gizliligi: sahip herseyi gorur; diger ekip
--   yalnizca atanmamis + kendine atanmis talepleri gorur.
-- - Ustlenme yaris-guvenli: talebi_ustlen() atomik.
-- ============================================================

-- 10a) Eski 'kapali' verileri 'cozuldu'ya tasi
-- ONEMLI SIRA: once eski kisit duser (yoksa update 23514 ile reddedilir),
-- sonra veri cevrilir, en son yeni kisit eklenir.
alter table public.destek_talepleri drop constraint if exists destek_talepleri_durum_check;

update public.destek_talepleri set durum = 'cozuldu' where durum = 'kapali';

alter table public.destek_talepleri add constraint destek_talepleri_durum_check
  check (durum in ('yeni','beklemede','incelemede','yanitlandi','cozuldu'));

-- 10b) ticket_events tipleri
alter table public.ticket_events drop constraint if exists ticket_events_event_type_check;
alter table public.ticket_events add constraint ticket_events_event_type_check
  check (event_type in ('acildi','durum','oncelik','atama','yanit','puan','kapatildi','not','ustlenme','devretme','cozulme','birakma'));

-- 10c) Havuz gizliligi: select politikasini degistir
drop policy if exists "destek_select_own_or_admin" on public.destek_talepleri;
create policy "destek_select_v2"
  on public.destek_talepleri for select
  using (
    user_id = auth.uid()
    or public.is_sahip()
    or (public.is_admin() and (atanan_admin is null or atanan_admin = auth.uid()))
  );

-- 10d) Yaris-guvenli ustlenme fonksiyonu
create or replace function public.talebi_ustlen(p_talep_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_ad text;
begin
  if not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  select ad into v_ad from public.site_admins where user_id = auth.uid();
  update public.destek_talepleri
    set atanan_admin = auth.uid(),
        durum = case when durum = 'yeni' then 'incelemede' else durum end,
        updated_at = now()
    where id = p_talep_id
      and (atanan_admin is null or atanan_admin = auth.uid());
  if not found then
    return false;
  end if;
  insert into public.ticket_events (talep_id, actor_id, actor_ad, event_type, meta)
    values (p_talep_id, auth.uid(), coalesce(v_ad, 'Ekip'), 'ustlenme', '{}');
  return true;
end;
$$;
grant execute on function public.talebi_ustlen(bigint) to authenticated;

-- 10e) Cozuldu + ayril fonksiyonu (tek buton)
create or replace function public.talebi_coz(p_talep_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_ad text;
begin
  if not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  select ad into v_ad from public.site_admins where user_id = auth.uid();
  update public.destek_talepleri
    set durum = 'cozuldu',
        atanan_admin = null,
        updated_at = now()
    where id = p_talep_id
      and (atanan_admin = auth.uid() or public.is_sahip());
  if not found then
    return false;
  end if;
  insert into public.ticket_events (talep_id, actor_id, actor_ad, event_type, meta)
    values (p_talep_id, auth.uid(), coalesce(v_ad, 'Ekip'), 'cozulme', '{}');
  return true;
end;
$$;
grant execute on function public.talebi_coz(bigint) to authenticated;

-- ============================================================
-- 11) DESTEK V3: sade mesajlasma + saglam rol sistemi
-- Dashboard > SQL Editor'de BIR KEZ calistir (idempotent).
-- - Timeline kaldirildi: ticket_events'e artik yazilmiyor.
--   Ekrani kirleten eski spam satirlari temizlenir.
-- - Devret: sahip, talebi baska yetkiliye aktarir.
-- - Son sahip korunur: son sahibin silinmesi/dusurulmesi engellenir.
-- - Yeni mesaj, talebin updated_at'ini otomatik gunceller.
-- ============================================================

-- 11a) Eski spam satirlari temizle (eski durum loglari: '—'/bos)
delete from public.ticket_events
  where event_type = 'durum' and coalesce(meta ->> 'eski', '') in ('', '—');

-- 11b) Devret fonksiyonu (yalnizca sahip)
create or replace function public.talebi_devret(p_talep_id bigint, p_yeni_admin uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_sahip() then
    raise exception 'yetkisiz';
  end if;
  if not exists (select 1 from public.site_admins where user_id = p_yeni_admin) then
    raise exception 'hedef yetkili degil';
  end if;
  update public.destek_talepleri
    set atanan_admin = p_yeni_admin,
        updated_at = now()
    where id = p_talep_id
      and durum not in ('cozuldu');
  return found;
end;
$$;
grant execute on function public.talebi_devret(bigint, uuid) to authenticated;

-- 11c) Son sahip korumasi (silme + dusurme)
create or replace function public.koru_son_sahip()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_say int;
begin
  if TG_OP = 'DELETE' then
    if OLD.rol = 'sahip' then
      select count(*) into v_say from public.site_admins where rol = 'sahip' and user_id <> OLD.user_id;
      if v_say = 0 then raise exception 'son sahip kaldirilamaz'; end if;
    end if;
    return OLD;
  else
    if OLD.rol = 'sahip' and NEW.rol <> 'sahip' then
      select count(*) into v_say from public.site_admins where rol = 'sahip' and user_id <> OLD.user_id;
      if v_say = 0 then raise exception 'son sahibin rolu dusurulemez'; end if;
    end if;
    return NEW;
  end if;
end;
$$;

drop trigger if exists trg_koru_son_sahip on public.site_admins;
create trigger trg_koru_son_sahip
  before delete or update of rol on public.site_admins
  for each row execute function public.koru_son_sahip();

-- 11d) Yeni mesaj -> talebin updated_at'i (siralama hep dogru)
create or replace function public.dokun_talep_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.destek_talepleri set updated_at = now() where id = NEW.talep_id;
  return NEW;
end;
$$;

drop trigger if exists trg_mesaj_updated_at on public.destek_mesajlari;
create trigger trg_mesaj_updated_at
  after insert on public.destek_mesajlari
  for each row execute function public.dokun_talep_updated_at();

-- ============================================================
-- 12) ROL SISTEMI V2: 6 rol
-- Roller ve yetkiler:
--   sahip    : hersey (roller, davet, tum talepler, devret, silme)
--   yonetici : tum talepler + devret + davet (sahibe dokunamaz)
--   yetkili  : havuz + ustlen + yanit + oncelik + coz + not
--   destek   : havuz + ustlen + yanit + coz + not (oncelik degistiremez)
--   rehber   : Rehber paneli (cozulen bilgi bankasi, salt okunur)
--   stajyer  : havuz salt okunur (ustlenemez, yazamaz)
-- Dashboard > SQL Editor'de BIR KEZ calistir (idempotent).
-- ============================================================

-- 12a) Eski 'admin' rolunu 'yetkili'ye tasi
update public.site_admins set rol = 'yetkili' where rol = 'admin';
update public.site_davetler set rol = 'yetkili' where rol = 'admin';

-- 12b) Rol kisitlari (6 rol) + YAKINSAMA BLOKU:
-- Hangi isimle olursa olsun ilgili tum check kisitlarini temizleyip
-- kanonik halleriyle yeniden kurar. Yari kalmis kurulumlari onarir,
-- tekrar calistirmak zararsizdir.
update public.site_admins set rol = 'yetkili' where rol = 'admin';
update public.site_davetler set rol = 'yetkili' where rol = 'admin';
update public.destek_talepleri set durum = 'cozuldu' where durum = 'kapali';

do $$
declare r record;
begin
  for r in select conrelid::regclass::text as tbl, conname as ad from pg_constraint
    where conrelid in ('public.destek_talepleri'::regclass, 'public.ticket_events'::regclass,
                       'public.site_admins'::regclass, 'public.site_davetler'::regclass)
      and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%durum%'
        or pg_get_constraintdef(oid) ilike '%event_type%'
        or pg_get_constraintdef(oid) ilike '%rol%')
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.ad);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'destek_talepleri_durum_check') then
    alter table public.destek_talepleri add constraint destek_talepleri_durum_check
      check (durum in ('yeni','beklemede','incelemede','yanitlandi','cozuldu'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ticket_events_event_type_check') then
    alter table public.ticket_events add constraint ticket_events_event_type_check
      check (event_type in ('acildi','durum','oncelik','atama','yanit','puan','kapatildi','not','ustlenme','devretme','cozulme','birakma'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'site_admins_rol_check') then
    alter table public.site_admins add constraint site_admins_rol_check
      check (rol in ('sahip','yonetici','yetkili','destek','rehber','stajyer'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'site_davetler_rol_check') then
    alter table public.site_davetler add constraint site_davetler_rol_check
      check (rol in ('sahip','yonetici','yetkili','destek','rehber','stajyer'));
  end if;
end $$;

-- 12c) Rol yardimcilari
create or replace function public.ekip_rolu()
returns text language sql security definer set search_path = public as $$
  select rol from public.site_admins where user_id = auth.uid();
$$;
grant execute on function public.ekip_rolu() to anon, authenticated;

create or replace function public.is_yonetici()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.site_admins
    where user_id = auth.uid() and rol in ('sahip','yonetici'));
$$;
grant execute on function public.is_yonetici() to anon, authenticated;

create or replace function public.is_rehber()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.site_admins
    where user_id = auth.uid() and rol = 'rehber');
$$;
grant execute on function public.is_rehber() to anon, authenticated;

-- 12d) Talep gorunurlugu V3 (rehber: yalnizca cozulen)
drop policy if exists "destek_select_v2" on public.destek_talepleri;
drop policy if exists "destek_select_v3" on public.destek_talepleri;
create policy "destek_select_v3"
  on public.destek_talepleri for select
  using (
    user_id = auth.uid()
    or public.is_yonetici()
    or (public.ekip_rolu() in ('yetkili','destek','stajyer')
        and (atanan_admin is null or atanan_admin = auth.uid()))
    or (public.is_rehber() and durum = 'cozuldu')
  );

-- 12e) Ekip mesaji: atanan + yonetici
drop policy if exists "destek_mesaj_insert_ekip" on public.destek_mesajlari;
create policy "destek_mesaj_insert_ekip_v2"
  on public.destek_mesajlari for insert
  with check (kim = 'ekip' and (public.is_yonetici() or exists (
    select 1 from public.destek_talepleri t
    where t.id = talep_id and t.atanan_admin = auth.uid()
  )));

-- 12f) Ic notlar: rehber haric ekip
drop policy if exists "destek_not_admin_all" on public.destek_notlar;
create policy "destek_not_ekip"
  on public.destek_notlar for all
  using (public.ekip_rolu() in ('sahip','yonetici','yetkili','destek','stajyer'))
  with check (public.ekip_rolu() in ('sahip','yonetici','yetkili','destek','stajyer'));

-- 12g) Rol yonetimi: yonetici+ (sahip satirlari korumali)
drop policy if exists "site_admins_update_sahip" on public.site_admins;
drop policy if exists "site_admins_delete_sahip" on public.site_admins;
create policy "site_admins_update_yonetici"
  on public.site_admins for update
  using (public.is_yonetici()) with check (public.is_yonetici());
create policy "site_admins_delete_yonetici"
  on public.site_admins for delete
  using (public.is_yonetici());

create or replace function public.koru_sahip_satiri()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.rol = 'sahip' and not public.is_sahip() then
      raise exception 'sahip satirina sadece sahip dokunabilir';
    end if;
    return OLD;
  else
    if OLD.rol = 'sahip' and not public.is_sahip() then
      raise exception 'sahip satirina sadece sahip dokunabilir';
    end if;
    if NEW.rol = 'sahip' and not public.is_sahip() then
      raise exception 'sahip rolunu sadece sahip verebilir';
    end if;
    return NEW;
  end if;
end;
$$;

drop trigger if exists trg_koru_sahip_satiri on public.site_admins;
create trigger trg_koru_sahip_satiri
  before delete or update of rol on public.site_admins
  for each row execute function public.koru_sahip_satiri();

-- 12h) Davet + log: yonetici+
drop policy if exists "davet_admin_all" on public.site_davetler;
create policy "davet_yonetici"
  on public.site_davetler for all
  using (public.is_yonetici()) with check (public.is_yonetici());

drop policy if exists "site_admins_insert_davet" on public.site_admins;
create policy "site_admins_insert_davet_v2"
  on public.site_admins for insert
  with check (user_id = auth.uid() and exists (select 1 from public.site_davetler d
    where d.email = (auth.jwt() ->> 'email')
    and d.rol in ('sahip','yonetici','yetkili','destek','rehber','stajyer')));

drop policy if exists "role_log_admin" on public.role_assignment_logs;
create policy "role_log_yonetici"
  on public.role_assignment_logs for all
  using (public.is_yonetici()) with check (public.is_yonetici());

-- 12i) Ustlen / coz / devret: rol kapilari
create or replace function public.talebi_ustlen(p_talep_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_ad text;
begin
  if public.ekip_rolu() not in ('sahip','yonetici','yetkili','destek') then
    raise exception 'rolun ustlenemez';
  end if;
  select ad into v_ad from public.site_admins where user_id = auth.uid();
  update public.destek_talepleri
    set atanan_admin = auth.uid(),
        durum = case when durum = 'yeni' then 'incelemede' else durum end,
        updated_at = now()
    where id = p_talep_id
      and (atanan_admin is null or atanan_admin = auth.uid());
  if not found then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.talebi_coz(p_talep_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'yetkisiz';
  end if;
  update public.destek_talepleri
    set durum = 'cozuldu',
        atanan_admin = null,
        updated_at = now()
    where id = p_talep_id
      and (atanan_admin = auth.uid() or public.is_yonetici());
  return found;
end;
$$;

create or replace function public.talebi_devret(p_talep_id bigint, p_yeni_admin uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_yonetici() then
    raise exception 'yetkisiz';
  end if;
  if not exists (select 1 from public.site_admins where user_id = p_yeni_admin) then
    raise exception 'hedef yetkili degil';
  end if;
  update public.destek_talepleri
    set atanan_admin = p_yeni_admin,
        updated_at = now()
    where id = p_talep_id
      and durum not in ('cozuldu');
  return found;
end;
$$;

-- ============================================================
-- 13) TAM GUVENLIK: kullanici yazmalari yalnizca verify-captcha
-- edge fonksiyonu (service_role) yapar. Bot direkt tabloya
-- yazamaz; RLS insert politikalari kaldirildi.
-- SIRA ONEMLI: once fonksiyon deploy + on yuz yayinda olsun,
-- SONRA bunu calistir (yoksa eski istemciler yazamaz).
-- ============================================================

drop policy if exists "destek_insert_own" on public.destek_talepleri;
drop policy if exists "site_reviews_insert_all" on public.site_reviews;
drop policy if exists "site_review_replies_insert_all" on public.site_review_replies;
drop policy if exists "destek_mesaj_insert_kullanici" on public.destek_mesajlari;
drop policy if exists "destek_puan_insert_own" on public.destek_puan;

-- ============================================================
-- 14) RPC-ODAKLI SIKILASTIRMA (red-team bulgulari)
-- - Direkt ticket UPDATE kapatildi: durum/oncelik/birak RPC'lerden gecer.
-- - Ic notlar: okuma+ekleme ekip, degistirme/silme yonetici+not sahibi.
-- - Dosya yuklemede klasor=user_id zorunlu.
-- - Davetler 7 gun gecerli; suresi dolmuslar temizlenir.
-- - Son yonetici+sahip havuzu korunur (tam kilitlenmeye karsi).
-- SIRA: once on yuz (RPC'li) yayinda olsun, SONRA bunu calistir.
-- ============================================================

-- 14a) Direkt ticket UPDATE kapat + RPC'ler
drop policy if exists "destek_update_admin" on public.destek_talepleri;

create or replace function public.talebi_durum(p_talep_id bigint, p_durum text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_durum not in ('yeni','beklemede','incelemede','yanitlandi') then
    raise exception 'gecersiz durum';
  end if;
  if public.ekip_rolu() not in ('sahip','yonetici','yetkili','destek','admin') then
    raise exception 'rolun durumu degistiremez';
  end if;
  update public.destek_talepleri
    set durum = p_durum, updated_at = now()
    where id = p_talep_id
      and (atanan_admin = auth.uid() or public.is_yonetici());
  return found;
end;
$$;
grant execute on function public.talebi_durum(bigint, text) to authenticated;

create or replace function public.talebi_oncelik(p_talep_id bigint, p_oncelik text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_oncelik not in ('dusuk','normal','yuksek','kritik') then
    raise exception 'gecersiz oncelik';
  end if;
  if public.ekip_rolu() not in ('sahip','yonetici','yetkili','admin') then
    raise exception 'rolun onceligi degistiremez';
  end if;
  update public.destek_talepleri
    set oncelik = p_oncelik, updated_at = now()
    where id = p_talep_id
      and (atanan_admin = auth.uid() or public.is_yonetici());
  return found;
end;
$$;
grant execute on function public.talebi_oncelik(bigint, text) to authenticated;

create or replace function public.talebi_birak(p_talep_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if public.ekip_rolu() not in ('sahip','yonetici','yetkili','destek','admin') then
    raise exception 'rolun birakamaz';
  end if;
  update public.destek_talepleri
    set atanan_admin = null, updated_at = now()
    where id = p_talep_id
      and (atanan_admin = auth.uid() or public.is_yonetici());
  return found;
end;
$$;
grant execute on function public.talebi_birak(bigint) to authenticated;

-- 14b) Ic notlar: okuma+ekleme ekip, degistirme/silme yonetici veya not sahibi
drop policy if exists "destek_not_admin_all" on public.destek_notlar;
drop policy if exists "destek_not_ekip" on public.destek_notlar;
create policy "destek_not_select"
  on public.destek_notlar for select
  using (public.ekip_rolu() in ('sahip','yonetici','yetkili','destek','stajyer','admin'));
create policy "destek_not_insert"
  on public.destek_notlar for insert
  with check (public.ekip_rolu() in ('sahip','yonetici','yetkili','destek','admin')
    and admin_id = auth.uid());
create policy "destek_not_change"
  on public.destek_notlar for update
  using (public.is_yonetici() or admin_id = auth.uid())
  with check (public.is_yonetici() or admin_id = auth.uid());
create policy "destek_not_delete"
  on public.destek_notlar for delete
  using (public.is_yonetici() or admin_id = auth.uid());

-- 14c) Dosya yuklemede klasor=user_id zorunlu (baskasinin klasorune cop yok)
drop policy if exists "destek_dosya_insert_auth" on storage.objects;
create policy "destek_dosya_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'destek-dosyalari'
    and auth.role() = 'authenticated'
    and storage.foldername(name)[1] = auth.uid()::text);

-- 14d) Davetler 7 gun gecerli + suresi dolmuslari temizle
delete from public.site_davetler where created_at < now() - interval '7 days';

drop policy if exists "site_admins_insert_davet" on public.site_admins;
drop policy if exists "site_admins_insert_davet_v2" on public.site_admins;
create policy "site_admins_insert_davet_v3"
  on public.site_admins for insert
  with check (user_id = auth.uid() and exists (select 1 from public.site_davetler d
    where d.email = (auth.jwt() ->> 'email')
    and d.created_at > now() - interval '7 days'
    and d.rol in ('sahip','yonetici','yetkili','destek','rehber','stajyer')));

-- 14e) Son yonetici+sahip havuzu korunur (tam kilitlenmeye karsi)
create or replace function public.koru_son_yonetici()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_say int;
begin
  if TG_OP = 'DELETE' then
    if OLD.rol in ('sahip','yonetici') then
      select count(*) into v_say from public.site_admins
        where rol in ('sahip','yonetici') and user_id <> OLD.user_id;
      if v_say = 0 then raise exception 'son yonetici kaldirilamaz'; end if;
    end if;
    return OLD;
  else
    if OLD.rol in ('sahip','yonetici') and NEW.rol not in ('sahip','yonetici') then
      select count(*) into v_say from public.site_admins
        where rol in ('sahip','yonetici') and user_id <> OLD.user_id;
      if v_say = 0 then raise exception 'son yoneticinin rolu dusurulemez'; end if;
    end if;
    return NEW;
  end if;
end;
$$;

drop trigger if exists trg_koru_son_yonetici on public.site_admins;
create trigger trg_koru_son_yonetici
  before delete or update of rol on public.site_admins
  for each row execute function public.koru_son_yonetici();

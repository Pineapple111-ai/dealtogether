-- =========================================================
-- 딜투게더 01. 기본 스키마 (MVP)
-- 구조: 상품 → 모델 → SKU(완성 조합) / 패키지 → 캠페인 → 주문
-- 모든 쓰기는 서버(service_role)에서만 수행, 클라이언트는 읽기만
-- =========================================================
create extension if not exists pgcrypto;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------
-- 회원 / 권한
-- ---------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text check (phone is null or phone ~ '^010-[0-9]{4}-[0-9]{4}$'),
  email text,
  role text not null default 'customer'
    check (role in ('customer','super_admin','product_admin','order_admin','cs')),
  marketing_agreed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_phone text := new.raw_user_meta_data->>'phone';
begin
  insert into profiles (id, email, name, phone, marketing_agreed)
  values (
    new.id, new.email,
    new.raw_user_meta_data->>'name',
    case when v_phone ~ '^010-[0-9]{4}-[0-9]{4}$' then v_phone else null end,
    coalesce((new.raw_user_meta_data->>'marketing_agreed')::boolean, false)
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role <> 'customer');
$$;

-- ---------------------------------------------------------
-- 사이트 설정 (단일 행)
-- ---------------------------------------------------------
create table site_settings (
  id int primary key default 1 check (id = 1),
  site_name text not null default '딜투게더',
  logo_url text,
  -- 외부 안전결제
  default_payment_url text,
  payment_provider_name text,
  payment_notice text not null default '안전한 거래를 위해 외부 안전결제 페이지로 이동합니다. 결제 완료 여부는 확인 절차에 따라 주문 내역에 반영됩니다.',
  allowed_payment_domains text[] not null default '{}',
  reservation_hours int not null default 24 check (reservation_hours between 1 and 168),
  closing_soon_hours int not null default 48,
  -- 사업자 정보 (관리자 입력, 임의 생성 금지)
  ceo_name text,
  business_number text,
  ecommerce_number text,
  business_address text,
  cs_phone text,
  cs_email text,
  cs_hours text,
  updated_at timestamptz not null default now()
);
insert into site_settings (id) values (1);
create trigger trg_site_settings_updated before update on site_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- 카탈로그: 브랜드 / 카테고리 / 상품 / 모델 / SKU
-- ---------------------------------------------------------
create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  theme_color text,
  payment_url text,                 -- 브랜드별 결제 링크 (선택)
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table categories (            -- 거실 / 주방 / 세탁·건조 / 에어케어 / 생활가전
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table products (              -- 예: LG OLED TV
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  product_type text not null,        -- TV, 사운드바, 냉장고 ...
  name text not null,
  description text,
  -- SKU 속성 선택 순서 (종속 드롭다운 순서) 예: {화면 크기, 색상}
  attribute_keys text[] not null default '{}',
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_products_updated before update on products
  for each row execute function set_updated_at();

create table product_models (        -- 실제 모델명
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  model_code text not null,
  model_name text not null,
  image_url text,
  specs jsonb not null default '{}',
  sort_order int not null default 0,
  status text not null default 'active' check (status in ('active','inactive')),
  unique (product_id, model_code)
);

create table product_skus (          -- 실제 판매 조합 (재고 단위)
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references product_models(id) on delete cascade,
  sku text not null unique,
  attributes jsonb not null default '{}',   -- {"화면 크기":"65인치","색상":"블랙"}
  image_url text,
  stock int not null default 0 check (stock >= 0),
  status text not null default 'active' check (status in ('active','inactive','soldout')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on product_skus (model_id);
create trigger trg_skus_updated before update on product_skus
  for each row execute function set_updated_at();

-- 부가 옵션 (설치 방식, 벽걸이 종류, 배관, 설치 키트 등)
create table addon_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  select_type text not null default 'single' check (select_type in ('single','multi')),
  ui_type text not null default 'radio' check (ui_type in ('radio','dropdown','checkbox','swatch','card')),
  is_required boolean not null default false,
  sort_order int not null default 0
);

create table addon_values (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references addon_groups(id) on delete cascade,
  label text not null,
  price int not null default 0 check (price >= 0),
  is_default boolean not null default false,
  is_quote_required boolean not null default false,  -- 현장 견적 필요
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- ---------------------------------------------------------
-- 패키지
-- ---------------------------------------------------------
create table packages (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id),
  category_id uuid not null references categories(id),
  name text not null,
  slug text not null unique,
  product_code text unique,
  summary text,
  description text,
  list_price int not null check (list_price >= 0),   -- 정상가 (기본 구성 기준)
  thumbnail_url text,
  images text[] not null default '{}',
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_packages_updated before update on packages
  for each row execute function set_updated_at();

create table package_items (         -- 패키지 구성품
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id) on delete cascade,
  product_id uuid not null references products(id),
  label text not null,               -- 화면 표시명: TV, 사운드바 ...
  is_required boolean not null default true,
  optional_price int not null default 0 check (optional_price >= 0), -- 선택 구성품 추가 시 기본 금액
  quantity int not null default 1 check (quantity > 0),
  sort_order int not null default 0
);
create index on package_items (package_id);

create table package_item_skus (     -- 구성품별 허용 SKU + 패키지별 추가금
  package_item_id uuid not null references package_items(id) on delete cascade,
  sku_id uuid not null references product_skus(id) on delete cascade,
  price_adjustment int not null default 0,   -- 기본 SKU 대비 추가금 (음수 허용 X)
  is_default boolean not null default false,
  primary key (package_item_id, sku_id),
  check (price_adjustment >= 0)
);
-- 구성품당 기본 SKU는 1개만
create unique index one_default_sku_per_item
  on package_item_skus (package_item_id) where is_default;

-- ---------------------------------------------------------
-- 공동구매 캠페인
-- ---------------------------------------------------------
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages(id),
  name text not null,
  slug text not null unique,
  start_at timestamptz not null,
  end_at timestamptz not null,
  target_participants int not null check (target_participants > 0),
  max_quantity int not null check (max_quantity > 0),   -- 총 판매 가능 세트
  per_user_limit int not null default 1 check (per_user_limit > 0),
  campaign_price int not null check (campaign_price >= 0), -- 공동구매 기본가
  sale_type text not null default 'fixed' check (sale_type in ('fixed','target','tiered')),
  payment_url text,                  -- 캠페인별 결제 링크 (최우선)
  closing_soon_hours int,            -- null이면 사이트 기본값
  allow_early_close boolean not null default true,
  is_visible boolean not null default true,
  manual_state text check (manual_state in ('closed','cancelled')), -- 조기 마감/취소
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index on campaigns (package_id);
create index on campaigns (end_at);
create trigger trg_campaigns_updated before update on campaigns
  for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- 주문
-- ---------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  idempotency_key text not null unique,
  user_id uuid references auth.users(id),
  participant_key text not null,     -- 회원: 'u:<uuid>' / 비회원: 'p:01012345678'
  campaign_id uuid not null references campaigns(id),
  status text not null default 'pending_payment' check (status in (
    'pending_payment','payment_verification','paid','preparing','shipping',
    'delivered','installation_scheduled','completed','cancelled','expired','refunded')),
  quantity int not null check (quantity > 0),
  -- 금액 (KRW 정수, 서버 계산)
  base_price int not null,
  option_total int not null default 0,
  optional_item_total int not null default 0,
  installation_fee int not null default 0,
  shipping_fee int not null default 0,
  discount_total int not null default 0,
  grand_total int not null check (grand_total >= 0),
  -- 주문자
  buyer_name text not null,
  buyer_phone text not null check (buyer_phone ~ '^010-[0-9]{4}-[0-9]{4}$'),
  buyer_email text,
  -- 배송지
  recipient_name text not null,
  recipient_phone text not null check (recipient_phone ~ '^010-[0-9]{4}-[0-9]{4}$'),
  zipcode text not null,
  address1 text not null,
  address2 text,
  delivery_memo text,
  -- 설치 정보 {wish_date, elevator, floor, pickup_old, environment, memo}
  installation_info jsonb not null default '{}',
  -- 구매 당시 스냅샷
  campaign_snapshot jsonb not null,
  payment_url_snapshot text,
  quote_required boolean not null default false,
  admin_memo text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on orders (campaign_id, status);
create index on orders (user_id);
create index on orders (buyer_phone);
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  package_item_id uuid references package_items(id),
  sku_id uuid references product_skus(id),
  is_optional boolean not null default false,
  -- 스냅샷
  item_label text not null,
  product_name text not null,
  model_code text not null,
  model_name text not null,
  sku_code text not null,
  attributes jsonb not null default '{}',
  addons jsonb not null default '[]',   -- [{group, label, price}]
  quantity int not null check (quantity > 0),  -- 세트수 × 구성 수량
  item_price int not null default 0,           -- 선택 구성품 금액
  sku_adjustment int not null default 0,
  addon_total int not null default 0
);
create index on order_items (order_id);

create table order_number_counters (
  day date primary key,
  last_value int not null default 0
);

create table order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by uuid references auth.users(id),
  reason text,
  created_at timestamptz not null default now()
);
create index on order_status_history (order_id);

create table payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider_name text,
  external_transaction_id text,
  expected_amount int not null,
  confirmed_amount int,
  status text not null default 'waiting' check (status in (
    'waiting','redirected','verifying','confirmed','failed','cancelled','refunding','refunded')),
  amount_mismatch boolean generated always as
    (confirmed_amount is not null and confirmed_amount <> expected_amount) stored,
  redirected_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  memo text,
  created_at timestamptz not null default now()
);
-- 주문당 확정 결제는 1건만 (중복 확인 방지)
create unique index one_confirmed_payment_per_order
  on payment_records (order_id) where status = 'confirmed';

create table inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sku_id uuid not null references product_skus(id),
  quantity int not null check (quantity > 0),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','consumed','released')),
  created_at timestamptz not null default now()
);
create index on inventory_reservations (sku_id, status);

create table admin_activity_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id),
  action text not null,
  target_type text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 집계 뷰 (실제 주문 기준, 허위 데이터 없음)
-- ---------------------------------------------------------
-- 확정 주문 상태
create or replace function is_confirmed_status(s text) returns boolean
language sql immutable as $$
  select s in ('paid','preparing','shipping','delivered','installation_scheduled','completed');
$$;

create or replace view campaign_stats as
select
  c.id as campaign_id,
  coalesce(count(distinct o.participant_key) filter (where is_confirmed_status(o.status)), 0)::int
    as participants,
  coalesce(sum(o.quantity) filter (where is_confirmed_status(o.status)), 0)::int
    as sold_quantity,
  coalesce(sum(o.quantity) filter (
    where o.status in ('pending_payment','payment_verification') and o.expires_at > now()), 0)::int
    as reserved_quantity
from campaigns c
left join orders o on o.campaign_id = c.id
group by c.id;

-- SKU 판매 가능 재고 = 재고 - 유효 예약
create or replace view sku_availability as
select
  s.id as sku_id,
  s.stock,
  coalesce(sum(r.quantity) filter (where r.status = 'active' and r.expires_at > now()), 0)::int
    as reserved,
  greatest(s.stock - coalesce(sum(r.quantity) filter (
    where r.status = 'active' and r.expires_at > now()), 0), 0)::int as available
from product_skus s
left join inventory_reservations r on r.sku_id = s.id
group by s.id;

grant select on campaign_stats, sku_availability to anon, authenticated;

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------
alter table profiles enable row level security;
alter table site_settings enable row level security;
alter table brands enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table product_models enable row level security;
alter table product_skus enable row level security;
alter table addon_groups enable row level security;
alter table addon_values enable row level security;
alter table packages enable row level security;
alter table package_items enable row level security;
alter table package_item_skus enable row level security;
alter table campaigns enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_number_counters enable row level security;
alter table order_status_history enable row level security;
alter table payment_records enable row level security;
alter table inventory_reservations enable row level security;
alter table admin_activity_logs enable row level security;

-- 공개 읽기 (카탈로그)
create policy "public read" on brands for select using (is_active or is_staff());
create policy "public read" on categories for select using (is_active or is_staff());
create policy "public read" on products for select using (status = 'active' or is_staff());
create policy "public read" on product_models for select using (status = 'active' or is_staff());
create policy "public read" on product_skus for select using (status <> 'inactive' or is_staff());
create policy "public read" on addon_groups for select using (true);
create policy "public read" on addon_values for select using (is_active or is_staff());
create policy "public read" on packages for select using (status = 'active' or is_staff());
create policy "public read" on package_items for select using (true);
create policy "public read" on package_item_skus for select using (true);
create policy "public read" on campaigns for select using (is_visible or is_staff());

-- 사이트 설정: 결제 URL 등은 서버에서만 사용 → 직원만 읽기
create policy "staff read" on site_settings for select using (is_staff());

-- 회원: 본인 프로필만 (수정은 서버에서)
create policy "own profile" on profiles for select using (id = auth.uid() or is_staff());

-- 주문: 본인 주문만 (비회원 조회는 서버에서 주문번호+휴대폰 확인)
create policy "own orders" on orders for select using (user_id = auth.uid() or is_staff());
create policy "own order items" on order_items for select using (
  exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_staff())));
create policy "own order history" on order_status_history for select using (
  exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_staff())));
create policy "own payments" on payment_records for select using (
  exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_staff())));

-- 직원 전용 읽기
create policy "staff read" on inventory_reservations for select using (is_staff());
create policy "staff read" on admin_activity_logs for select using (is_staff());

-- INSERT/UPDATE/DELETE 정책 없음 → 모든 쓰기는 service_role(서버)만 가능
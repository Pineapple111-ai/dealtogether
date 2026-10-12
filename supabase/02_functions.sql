-- =========================================================
-- 딜투게더 02. 주문 / 결제 / 재고 함수
-- 모든 함수는 서버(service_role)에서만 호출 가능
-- 가격 계산·옵션 검증은 서버(TS)에서 하고, 여기서는
-- 동시성(잠금)·재고·캠페인 한도·상태 전이를 원자적으로 처리
-- =========================================================

-- ---------------------------------------------------------
-- 주문번호: DT-YYYYMMDD-000001 (KST 기준, 일별 증가)
-- ---------------------------------------------------------
create or replace function next_order_number() returns text
language plpgsql set search_path = public as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v int;
begin
  insert into order_number_counters (day, last_value) values (v_day, 1)
  on conflict (day) do update set last_value = order_number_counters.last_value + 1
  returning last_value into v;
  return 'DT-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v::text, 6, '0');
end $$;

-- ---------------------------------------------------------
-- 주문 생성 + 재고 예약 (원자적)
-- ---------------------------------------------------------
create or replace function create_order(p jsonb) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_key text := p->>'idempotency_key';
  v_qty int := (p->>'quantity')::int;
  v_pkey text := p->>'participant_key';
  v_existing orders%rowtype;
  c campaigns%rowtype;
  v_sold int; v_reserved int; v_mine int;
  v_hours int;
  v_expires timestamptz;
  v_order_id uuid;
  v_number text;
  r record;
begin
  if v_key is null or length(v_key) < 16 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  if v_qty is null or v_qty < 1 then raise exception 'INVALID_QUANTITY'; end if;
  if v_pkey is null then raise exception 'INVALID_PARTICIPANT'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]')) = 0 then raise exception 'NO_ITEMS'; end if;

  -- 중복 요청 방지
  perform pg_advisory_xact_lock(hashtext(v_key));
  select * into v_existing from orders where idempotency_key = v_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id,
      'order_number', v_existing.order_number, 'duplicate', true);
  end if;

  -- 캠페인 잠금 + 진행 여부 (서버 시간 기준)
  select * into c from campaigns where id = (p->>'campaign_id')::uuid for update;
  if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  if not c.is_visible or c.manual_state is not null
     or now() < c.start_at or now() >= c.end_at then
    raise exception 'CAMPAIGN_CLOSED';
  end if;

  -- 캠페인 수량 / 1인 한도
  select
    coalesce(sum(quantity) filter (where is_confirmed_status(status)), 0),
    coalesce(sum(quantity) filter (where status in ('pending_payment','payment_verification')
                                     and expires_at > now()), 0),
    coalesce(sum(quantity) filter (where participant_key = v_pkey and (
      is_confirmed_status(status) or
      (status in ('pending_payment','payment_verification') and expires_at > now()))), 0)
  into v_sold, v_reserved, v_mine
  from orders where campaign_id = c.id;

  if v_sold + v_reserved + v_qty > c.max_quantity then raise exception 'CAMPAIGN_SOLD_OUT'; end if;
  if v_mine + v_qty > c.per_user_limit then raise exception 'PER_USER_LIMIT'; end if;

  select reservation_hours into v_hours from site_settings where id = 1;
  v_expires := now() + make_interval(hours => coalesce(v_hours, 24));

  -- SKU 잠금 (데드락 방지 위해 id 순)
  perform 1 from product_skus
   where id in (select (i->>'sku_id')::uuid from jsonb_array_elements(p->'items') i)
   order by id for update;

  -- 재고 확인
  for r in
    select x.sku_id, x.need, s.sku, s.stock, s.status,
      coalesce((select sum(ir.quantity) from inventory_reservations ir
                 where ir.sku_id = x.sku_id and ir.status = 'active'
                   and ir.expires_at > now()), 0) as reserved
    from (select (i->>'sku_id')::uuid as sku_id, sum((i->>'quantity')::int) as need
            from jsonb_array_elements(p->'items') i group by 1) x
    left join product_skus s on s.id = x.sku_id
  loop
    if r.sku is null then raise exception 'SKU_NOT_FOUND'; end if;
    if r.status <> 'active' or r.stock - r.reserved < r.need then
      raise exception 'OUT_OF_STOCK:%', r.sku;
    end if;
  end loop;

  v_number := next_order_number();

  insert into orders (
    order_number, idempotency_key, user_id, participant_key, campaign_id, status, quantity,
    base_price, option_total, optional_item_total, installation_fee, shipping_fee,
    discount_total, grand_total,
    buyer_name, buyer_phone, buyer_email,
    recipient_name, recipient_phone, zipcode, address1, address2, delivery_memo,
    installation_info, campaign_snapshot, payment_url_snapshot, quote_required, expires_at
  ) values (
    v_number, v_key, nullif(p->>'user_id', '')::uuid, v_pkey, c.id, 'pending_payment', v_qty,
    (p->>'base_price')::int, (p->>'option_total')::int, (p->>'optional_item_total')::int,
    (p->>'installation_fee')::int, (p->>'shipping_fee')::int,
    (p->>'discount_total')::int, (p->>'grand_total')::int,
    p->>'buyer_name', p->>'buyer_phone', nullif(p->>'buyer_email', ''),
    p->>'recipient_name', p->>'recipient_phone', p->>'zipcode', p->>'address1',
    nullif(p->>'address2', ''), nullif(p->>'delivery_memo', ''),
    coalesce(p->'installation_info', '{}'), p->'campaign_snapshot',
    p->>'payment_url', coalesce((p->>'quote_required')::boolean, false), v_expires
  ) returning id into v_order_id;

  insert into order_items (
    order_id, package_item_id, sku_id, is_optional, item_label, product_name,
    model_code, model_name, sku_code, attributes, addons, quantity,
    item_price, sku_adjustment, addon_total
  )
  select v_order_id, (i->>'package_item_id')::uuid, (i->>'sku_id')::uuid,
    coalesce((i->>'is_optional')::boolean, false), i->>'item_label', i->>'product_name',
    i->>'model_code', i->>'model_name', i->>'sku_code',
    coalesce(i->'attributes', '{}'), coalesce(i->'addons', '[]'), (i->>'quantity')::int,
    coalesce((i->>'item_price')::int, 0), coalesce((i->>'sku_adjustment')::int, 0),
    coalesce((i->>'addon_total')::int, 0)
  from jsonb_array_elements(p->'items') i;

  insert into inventory_reservations (order_id, sku_id, quantity, expires_at)
  select v_order_id, (i->>'sku_id')::uuid, sum((i->>'quantity')::int), v_expires
  from jsonb_array_elements(p->'items') i group by 2;

  insert into payment_records (order_id, provider_name, expected_amount)
  values (v_order_id, p->>'provider_name', (p->>'grand_total')::int);

  insert into order_status_history (order_id, previous_status, new_status, reason)
  values (v_order_id, null, 'pending_payment', '주문 접수');

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_number,
    'expires_at', v_expires, 'duplicate', false);
end $$;

-- ---------------------------------------------------------
-- 외부 결제 페이지 이동 기록 (결제 완료 아님)
-- ---------------------------------------------------------
create or replace function mark_payment_redirected(p_order_id uuid) returns void
language plpgsql set search_path = public as $$
begin
  update payment_records
     set status = 'redirected', redirected_at = now()
   where order_id = p_order_id and status in ('waiting','redirected');
end $$;

-- ---------------------------------------------------------
-- 관리자 결제 확인
--  - 금액 불일치: p_force 없으면 차단
--  - 만료 주문: p_force 없으면 차단, 있어도 재고·캠페인 한도 재검증
--  - 중복 확인 방지 (주문 잠금 + 확정 결제 유니크 인덱스)
-- ---------------------------------------------------------
create or replace function confirm_payment(
  p_order_id uuid,
  p_admin_id uuid,
  p_confirmed_amount int,
  p_provider text default null,
  p_tx_id text default null,
  p_memo text default null,
  p_force boolean default false
) returns jsonb
language plpgsql set search_path = public as $$
declare
  o orders%rowtype;
  c campaigns%rowtype;
  v_sold int; v_reserved int;
  r record;
  v_pr_id uuid;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if is_confirmed_status(o.status) then raise exception 'ALREADY_PAID'; end if;
  if o.status not in ('pending_payment','payment_verification','expired') then
    raise exception 'INVALID_STATUS:%', o.status;
  end if;
  if p_confirmed_amount is null or p_confirmed_amount < 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_confirmed_amount <> o.grand_total and not p_force then raise exception 'AMOUNT_MISMATCH'; end if;
  if (o.status = 'expired' or o.expires_at <= now()) and not p_force then
    raise exception 'EXPIRED_NEEDS_REVIEW';
  end if;

  -- 캠페인 한도 재검증 (이 주문 제외)
  select * into c from campaigns where id = o.campaign_id for update;
  select
    coalesce(sum(quantity) filter (where is_confirmed_status(status)), 0),
    coalesce(sum(quantity) filter (where status in ('pending_payment','payment_verification')
                                     and expires_at > now()), 0)
  into v_sold, v_reserved
  from orders where campaign_id = o.campaign_id and id <> o.id;
  if v_sold + v_reserved + o.quantity > c.max_quantity then raise exception 'CAMPAIGN_CAPACITY'; end if;

  -- 이 주문의 예약을 풀고, 남은 재고로 다시 확인 후 차감
  update inventory_reservations set status = 'released'
   where order_id = o.id and status = 'active';

  perform 1 from product_skus
   where id in (select sku_id from order_items where order_id = o.id)
   order by id for update;

  for r in
    select x.sku_id, x.need, s.sku, s.stock,
      coalesce((select sum(ir.quantity) from inventory_reservations ir
                 where ir.sku_id = x.sku_id and ir.status = 'active'
                   and ir.expires_at > now()), 0) as reserved
    from (select sku_id, sum(quantity) as need from order_items
           where order_id = o.id group by sku_id) x
    join product_skus s on s.id = x.sku_id
  loop
    if r.stock - r.reserved < r.need then raise exception 'STOCK_RECHECK_FAILED:%', r.sku; end if;
    update product_skus set stock = stock - r.need where id = r.sku_id;
  end loop;

  update inventory_reservations set status = 'consumed'
   where order_id = o.id and status = 'released';

  -- 결제 기록
  select id into v_pr_id from payment_records
   where order_id = o.id and status in ('waiting','redirected','verifying')
   order by created_at desc limit 1;

  if v_pr_id is null then
    insert into payment_records (order_id, expected_amount)
    values (o.id, o.grand_total) returning id into v_pr_id;
  end if;

  update payment_records set
    status = 'confirmed',
    confirmed_amount = p_confirmed_amount,
    provider_name = coalesce(p_provider, provider_name),
    external_transaction_id = p_tx_id,
    verified_at = now(),
    verified_by = p_admin_id,
    memo = p_memo
  where id = v_pr_id;

  update orders set status = 'paid', paid_at = now() where id = o.id;

  insert into order_status_history (order_id, previous_status, new_status, changed_by, reason)
  values (o.id, o.status, 'paid', p_admin_id,
    case when p_force then '결제 확인 (관리자 강제 확인: ' || coalesce(p_memo, '사유 미기재') || ')'
         else '결제 확인' end);

  insert into admin_activity_logs (admin_id, action, target_type, target_id, detail)
  values (p_admin_id, 'confirm_payment', 'order', o.order_number,
    jsonb_build_object('expected', o.grand_total, 'confirmed', p_confirmed_amount,
                       'tx_id', p_tx_id, 'force', p_force));

  return jsonb_build_object('order_id', o.id, 'status', 'paid');
end $$;

-- ---------------------------------------------------------
-- 주문 상태 변경 (결제 확인 제외)
-- p_actor null = 고객 본인 요청 (서버에서 본인 확인 후 호출)
-- ---------------------------------------------------------
create or replace function change_order_status(
  p_order_id uuid,
  p_new_status text,
  p_actor uuid default null,
  p_reason text default null,
  p_restock boolean default true
) returns jsonb
language plpgsql set search_path = public as $$
declare
  o orders%rowtype;
  v_allowed text[];
  r record;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  v_allowed := case o.status
    when 'pending_payment'        then array['payment_verification','cancelled','expired']
    when 'payment_verification'   then array['pending_payment','cancelled','expired']
    when 'paid'                   then array['preparing','cancelled','refunded']
    when 'preparing'              then array['shipping','cancelled','refunded']
    when 'shipping'               then array['delivered','refunded']
    when 'delivered'              then array['installation_scheduled','completed','refunded']
    when 'installation_scheduled' then array['completed','refunded']
    when 'completed'              then array['refunded']
    when 'expired'                then array['cancelled']
    else array[]::text[]
  end;

  if not (p_new_status = any(v_allowed)) then
    raise exception 'INVALID_TRANSITION:%->%', o.status, p_new_status;
  end if;

  -- 고객은 결제 전 주문 취소만 가능
  if p_actor is null and not (p_new_status = 'cancelled'
       and o.status in ('pending_payment','payment_verification')) then
    raise exception 'FORBIDDEN';
  end if;

  -- 결제 전 취소/만료: 예약 해제
  if p_new_status in ('cancelled','expired') and not is_confirmed_status(o.status) then
    update inventory_reservations set status = 'released'
     where order_id = o.id and status = 'active';
    update payment_records set status = 'cancelled'
     where order_id = o.id and status in ('waiting','redirected','verifying');
  end if;

  -- 결제 후 취소/환불: 재고 복구 + 결제기록 갱신 (참여 집계는 뷰에서 자동 제외)
  if p_new_status in ('cancelled','refunded') and is_confirmed_status(o.status) then
    if p_restock then
      for r in select sku_id, sum(quantity) as q from order_items
                where order_id = o.id and sku_id is not null group by sku_id
      loop
        update product_skus set stock = stock + r.q where id = r.sku_id;
      end loop;
    end if;
    update payment_records
       set status = case when p_new_status = 'refunded' then 'refunded' else 'cancelled' end
     where order_id = o.id and status = 'confirmed';
  end if;

  update orders set status = p_new_status where id = o.id;

  insert into order_status_history (order_id, previous_status, new_status, changed_by, reason)
  values (o.id, o.status, p_new_status, p_actor, p_reason);

  if p_actor is not null then
    insert into admin_activity_logs (admin_id, action, target_type, target_id, detail)
    values (p_actor, 'change_order_status', 'order', o.order_number,
      jsonb_build_object('from', o.status, 'to', p_new_status, 'reason', p_reason));
  end if;

  return jsonb_build_object('order_id', o.id, 'status', p_new_status);
end $$;

-- ---------------------------------------------------------
-- 결제 대기 주문 만료 처리 (예약 해제)
-- ---------------------------------------------------------
create or replace function expire_orders() returns int
language plpgsql set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id, status from orders
     where status in ('pending_payment','payment_verification') and expires_at <= now()
     for update skip locked
  loop
    update inventory_reservations set status = 'released'
     where order_id = r.id and status = 'active';
    update payment_records set status = 'cancelled'
     where order_id = r.id and status in ('waiting','redirected');
    update orders set status = 'expired' where id = r.id;
    insert into order_status_history (order_id, previous_status, new_status, reason)
    values (r.id, r.status, 'expired', '결제 대기시간 만료');
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------
-- 권한: 서버(service_role)만 실행
-- ---------------------------------------------------------
revoke execute on function next_order_number() from public, anon, authenticated;
revoke execute on function create_order(jsonb) from public, anon, authenticated;
revoke execute on function mark_payment_redirected(uuid) from public, anon, authenticated;
revoke execute on function confirm_payment(uuid, uuid, int, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function change_order_status(uuid, text, uuid, text, boolean) from public, anon, authenticated;
revoke execute on function expire_orders() from public, anon, authenticated;

grant execute on function next_order_number() to service_role;
grant execute on function create_order(jsonb) to service_role;
grant execute on function mark_payment_redirected(uuid) to service_role;
grant execute on function confirm_payment(uuid, uuid, int, text, text, text, boolean) to service_role;
grant execute on function change_order_status(uuid, text, uuid, text, boolean) to service_role;
grant execute on function expire_orders() to service_role;

-- ---------------------------------------------------------
-- 10분마다 만료 처리 (pg_cron)
-- ---------------------------------------------------------
create extension if not exists pg_cron;
select cron.schedule('dt-expire-orders', '*/10 * * * *', $$select public.expire_orders()$$);
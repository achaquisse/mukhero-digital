-- A sale may be recorded at a unit price different from the product's current
-- price (discount, negotiated price…). The override applies to that sale only;
-- the product's price history is untouched. Omitting p_price keeps the old
-- behaviour (current product price).

drop function public.record_sale(uuid, uuid, integer, text, date);

create function public.record_sale(
  p_org uuid,
  p_product uuid,
  p_qty integer,
  p_customer text,
  p_date date,
  p_price numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_price numeric;
  v_left integer := p_qty;
  v_take integer;
  v_first uuid;
  v_id uuid;
  v_avail integer := 0;
  v_name text := private.my_name();
  v_uid uuid := (select auth.uid());
  r record;
begin
  perform private.require_role(p_org, 'Admin', 'Vendas');
  if p_qty is null or p_qty < 1 then
    raise exception 'Quantidade inválida' using errcode = '22023';
  end if;
  if p_date is null or p_date > current_date then
    raise exception 'A data não pode ser no futuro' using errcode = '22023';
  end if;
  select * into v_product from public.products where id = p_product and org_id = p_org;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'P0002';
  end if;
  select price into v_price from public.price_history where product_id = p_product order by effective_at desc, id desc limit 1;
  if coalesce(v_price, 0) <= 0 then
    raise exception 'O produto não tem preço de venda' using errcode = '22023';
  end if;
  if p_price is not null then
    if p_price <= 0 then
      raise exception 'Preço unitário inválido' using errcode = '22023';
    end if;
    v_price := p_price;
  end if;

  if v_product.is_service then
    insert into public.sales (org_id, product_id, lot_id, qty, price, customer, date, sold_by, sold_by_name)
    values (p_org, p_product, null, p_qty, v_price, btrim(coalesce(p_customer, '')), p_date, v_uid, v_name)
    returning id into v_first;
    return v_first;
  end if;

  -- Lock this product's received lots so concurrent sales queue up here.
  perform 1 from public.lots where product_id = p_product and status = 'recebido' for update;

  for r in
    select l.id, l.qty - l.lost - coalesce((select sum(s.qty) from public.sales s where s.lot_id = l.id), 0) as left_qty
    from public.lots l
    where l.product_id = p_product and l.status = 'recebido'
    order by l.arrival_date, l.created_at
  loop
    continue when r.left_qty <= 0;
    v_avail := v_avail + r.left_qty;
    exit when v_left <= 0;
    v_take := least(v_left, r.left_qty);
    insert into public.sales (org_id, product_id, lot_id, qty, price, customer, date, sold_by, sold_by_name)
    values (p_org, p_product, r.id, v_take, v_price, btrim(coalesce(p_customer, '')), p_date, v_uid, v_name)
    returning id into v_id;
    v_first := coalesce(v_first, v_id);
    v_left := v_left - v_take;
  end loop;

  if v_left > 0 then
    raise exception 'Stock insuficiente: % disponíveis', v_avail using errcode = 'P0001';
  end if;
  return v_first;
end;
$$;

revoke execute on function public.record_sale(uuid, uuid, integer, text, date, numeric) from public, anon;
grant execute on function public.record_sale(uuid, uuid, integer, text, date, numeric) to authenticated;

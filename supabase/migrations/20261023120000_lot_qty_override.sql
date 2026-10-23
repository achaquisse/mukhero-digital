-- Admin-only correction of a lot's quantity, allowed in any status (including
-- received / sold out). The quantity can never drop below what was already
-- sold or written off, so stock never goes negative.

create or replace function private.guard_received_lot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_qty_override boolean := coalesce(current_setting('app.lot_qty_override', true), '') = 'on';
begin
  if old.status = 'recebido' and (
    new.product_id <> old.product_id
    or new.status <> old.status
    or (new.qty <> old.qty and not v_qty_override)
  ) then
    raise exception 'Lotes recebidos não podem ser editados' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create function public.set_lot_qty(p_lot uuid, p_qty integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot public.lots%rowtype;
  v_sold integer;
begin
  select * into v_lot from public.lots where id = p_lot for update;
  if not found then
    raise exception 'Lote não encontrado' using errcode = 'P0002';
  end if;
  perform private.require_role(v_lot.org_id, 'Admin');
  if p_qty is null or p_qty < 1 then
    raise exception 'Quantidade inválida' using errcode = '22023';
  end if;
  select coalesce(sum(qty), 0) into v_sold from public.sales where lot_id = p_lot;
  if p_qty < v_sold + v_lot.lost then
    raise exception 'A quantidade não pode ser inferior a % (vendidos e perdidos)', v_sold + v_lot.lost using errcode = '22023';
  end if;
  if p_qty = v_lot.qty then
    return;
  end if;
  perform set_config('app.lot_qty_override', 'on', true);
  update public.lots set qty = p_qty where id = p_lot;
  perform set_config('app.lot_qty_override', 'off', true);
end;
$$;

revoke execute on function public.set_lot_qty(uuid, integer) from public, anon;
grant execute on function public.set_lot_qty(uuid, integer) to authenticated;

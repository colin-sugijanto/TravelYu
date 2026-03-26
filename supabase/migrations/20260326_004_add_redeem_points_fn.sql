create or replace function public.redeem_planning_points(
  p_user_id uuid,
  p_points_to_deduct int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_lifetime int;
  v_new_balance int;
  v_tier public.loyalty_tier;
begin
  if p_points_to_deduct is null or p_points_to_deduct <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Invalid points amount');
  end if;

  select points_balance, lifetime_points
  into v_balance, v_lifetime
  from public.users
  where id = p_user_id
  for update;

  if v_balance is null then
    return jsonb_build_object('ok', false, 'error', 'Profile not found');
  end if;

  if v_balance < p_points_to_deduct then
    return jsonb_build_object('ok', false, 'error', 'Insufficient points');
  end if;

  v_new_balance := v_balance - p_points_to_deduct;
  v_tier := public.refresh_loyalty_tier(v_new_balance);

  update public.users
  set
    points_balance = v_new_balance,
    loyalty_tier = v_tier,
    updated_at = now()
  where id = p_user_id;

  insert into public.user_points (
    user_id,
    points_balance,
    lifetime_points,
    tier,
    updated_at
  )
  values (
    p_user_id,
    v_new_balance,
    coalesce(v_lifetime, v_new_balance),
    v_tier,
    now()
  )
  on conflict (user_id)
  do update set
    points_balance = excluded.points_balance,
    lifetime_points = excluded.lifetime_points,
    tier = excluded.tier,
    updated_at = now();

  insert into public.user_points_log (user_id, points_delta, event_type)
  values (p_user_id, -p_points_to_deduct, 'redeem_planning_fee');

  return jsonb_build_object(
    'ok', true,
    'new_balance', v_new_balance,
    'redeemed_points', p_points_to_deduct,
    'tier', v_tier
  );
end;
$$;

revoke execute on function public.redeem_planning_points(uuid, int) from public;
revoke execute on function public.redeem_planning_points(uuid, int) from anon;
revoke execute on function public.redeem_planning_points(uuid, int) from authenticated;
grant execute on function public.redeem_planning_points(uuid, int) to service_role;

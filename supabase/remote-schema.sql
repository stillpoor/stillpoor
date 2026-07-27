


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."cancel_claim_order"("p_order_id" "uuid", "p_payment_address" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_order public.claim_orders%rowtype;
begin
  select *
  into v_order
  from public.claim_orders
  where id = p_order_id
  for update;

  if not found then
    return false;
  end if;

  if (
    v_order.payment_address <>
    p_payment_address
  ) then
    raise exception
      'The wallet does not own this order.';
  end if;

  if v_order.status <> 'pending' then
    return false;
  end if;

  update public.blocks
  set
    status = 'available',
    reservation_order_id = null,
    reservation_expires_at = null
  where
    reservation_order_id = p_order_id
    and status = 'reserved';

  update public.claim_orders
  set status = 'cancelled'
  where id = p_order_id;

  return true;
end;
$$;


ALTER FUNCTION "public"."cancel_claim_order"("p_order_id" "uuid", "p_payment_address" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_claim_order_simulated"("p_order_id" "uuid", "p_payment_address" "text") RETURNS TABLE("block_number" smallint, "block_row" smallint, "block_column" smallint, "owner_payment_address" "text", "pixels" "text"[], "description" "text", "claimed_at" timestamp with time zone, "updated_at" timestamp with time zone, "claim_transaction_id" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_order public.claim_orders%rowtype;
  v_reserved_count integer;
begin
  select *
  into v_order
  from public.claim_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception
      'The Claim order does not exist.';
  end if;

  if (
    v_order.payment_address <>
    p_payment_address
  ) then
    raise exception
      'The wallet does not own this order.';
  end if;

  if v_order.status <> 'pending' then
    raise exception
      'The Claim order is no longer pending.';
  end if;

  if v_order.expires_at <= now() then
    raise exception
      'The Claim order has expired.';
  end if;

  perform blocks.block_number
  from public.blocks as blocks
  where
    blocks.reservation_order_id =
      p_order_id
  order by blocks.block_number
  for update;

  get diagnostics
    v_reserved_count = row_count;

  if (
    v_reserved_count <>
    cardinality(v_order.block_numbers)
  ) then
    raise exception
      'The Block reservation is incomplete.';
  end if;

  update public.blocks as blocks
  set
    status = 'claimed',

    owner_payment_address =
      v_order.payment_address,

    owner_ordinals_address =
      v_order.ordinals_address,

    pixels = array_fill(
      '#ffffff'::text,
      array[256]
    ),

    description = null,
    claimed_at = now(),

    claim_transaction_id =
      'simulated-'
      || p_order_id::text
      || '-'
      || blocks.block_number::text,

    reservation_order_id = null,
    reservation_expires_at = null
  where
    blocks.reservation_order_id =
      p_order_id;

  update public.claim_orders
  set
    status = 'paid',
    payment_txid =
      'simulated-' || p_order_id::text
  where id = p_order_id;

  return query
  select
    blocks.block_number,
    blocks.block_row,
    blocks.block_column,
    blocks.owner_payment_address,
    blocks.pixels,
    blocks.description,
    blocks.claimed_at,
    blocks.updated_at,
    blocks.claim_transaction_id
  from public.blocks as blocks
  where
    blocks.block_number =
      any(v_order.block_numbers)
  order by blocks.block_number;
end;
$$;


ALTER FUNCTION "public"."confirm_claim_order_simulated"("p_order_id" "uuid", "p_payment_address" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_wallet_session"("p_challenge_id" "uuid", "p_session_token_hash" "text", "p_session_expires_at" timestamp with time zone) RETURNS TABLE("payment_address" "text", "ordinals_address" "text", "session_expires_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_challenge
    public.wallet_auth_challenges%rowtype;
begin
  if p_challenge_id is null then
    raise exception
      'A challenge ID is required.';
  end if;

  if (
    p_session_token_hash is null
    or btrim(p_session_token_hash) = ''
  ) then
    raise exception
      'A session token hash is required.';
  end if;

  if (
    p_session_expires_at is null
    or p_session_expires_at <= now()
  ) then
    raise exception
      'The session expiry is invalid.';
  end if;

  /*
   * Lock the challenge while creating the session.
   * This prevents two requests from consuming it
   * at the same time.
   */
  select challenges.*
  into v_challenge
  from public.wallet_auth_challenges
    as challenges
  where challenges.id =
    p_challenge_id
  for update;

  if not found then
    raise exception
      'The authentication challenge does not exist.';
  end if;

  if v_challenge.used_at is not null then
    raise exception
      'The authentication challenge has already been used.';
  end if;

  if v_challenge.expires_at <= now() then
    raise exception
      'The authentication challenge has expired.';
  end if;

  update public.wallet_auth_challenges
    as challenge_to_use
  set
    used_at = now()
  where
    challenge_to_use.id =
      p_challenge_id;

  insert into public.wallet_sessions (
    payment_address,
    ordinals_address,
    token_hash,
    expires_at
  )
  values (
    v_challenge.payment_address,
    v_challenge.ordinals_address,
    p_session_token_hash,
    p_session_expires_at
  );

  return query
  select
    v_challenge.payment_address,
    v_challenge.ordinals_address,
    p_session_expires_at;
end;
$$;


ALTER FUNCTION "public"."create_wallet_session"("p_challenge_id" "uuid", "p_session_token_hash" "text", "p_session_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_claim_blocks"("p_payment_address" "text", "p_ordinals_address" "text", "p_block_numbers" smallint[], "p_amount_sats" bigint, "p_receiver_address" "text") RETURNS TABLE("order_id" "uuid", "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_order_id uuid;

  v_expires_at timestamptz :=
    now() + interval '10 minutes';

  v_requested_count integer;
  v_found_count integer;
  v_unavailable_count integer;
begin
  if (
    p_payment_address is null
    or btrim(p_payment_address) = ''
  ) then
    raise exception
      'A payment address is required.';
  end if;

  if (
    p_ordinals_address is null
    or btrim(p_ordinals_address) = ''
  ) then
    raise exception
      'An Ordinals address is required.';
  end if;

  if (
    p_receiver_address is null
    or btrim(p_receiver_address) = ''
  ) then
    raise exception
      'A receiver address is required.';
  end if;

  if (
    p_block_numbers is null
    or cardinality(p_block_numbers) = 0
  ) then
    raise exception
      'At least one Block is required.';
  end if;

  if cardinality(p_block_numbers) > 100 then
    raise exception
      'A maximum of 100 Blocks may be reserved.';
  end if;

  if p_amount_sats <= 0 then
    raise exception
      'The payment amount must be positive.';
  end if;

  if exists (
    select 1
    from unnest(p_block_numbers)
      as requested(block_number)
    where
      requested.block_number < 1
      or requested.block_number > 4096
  ) then
    raise exception
      'One or more Block numbers are invalid.';
  end if;

  select count(
    distinct requested.block_number
  )
  into v_requested_count
  from unnest(p_block_numbers)
    as requested(block_number);

  if (
    v_requested_count <>
    cardinality(p_block_numbers)
  ) then
    raise exception
      'The Block selection contains duplicates.';
  end if;

  update public.blocks
  set
    status = 'available',
    reservation_order_id = null,
    reservation_expires_at = null
  where
    status = 'reserved'
    and reservation_expires_at <= now();

  /*
   * La table reçoit un alias pour distinguer
   * sa colonne expires_at de la valeur retournée
   * par la fonction.
   */
  update public.claim_orders as orders
  set status = 'expired'
  where
    orders.status = 'pending'
    and orders.expires_at <= now();

  perform blocks.block_number
  from public.blocks as blocks
  where
    blocks.block_number =
      any(p_block_numbers)
  order by blocks.block_number
  for update;

  get diagnostics
    v_found_count = row_count;

  if (
    v_found_count <>
    cardinality(p_block_numbers)
  ) then
    raise exception
      'One or more Blocks do not exist.';
  end if;

  select count(*)
  into v_unavailable_count
  from public.blocks as blocks
  where
    blocks.block_number =
      any(p_block_numbers)
    and blocks.status <> 'available';

  if v_unavailable_count > 0 then
    raise exception
      'One or more Blocks are no longer available.';
  end if;

  insert into public.claim_orders (
    payment_address,
    ordinals_address,
    block_numbers,
    amount_sats,
    receiver_address,
    status,
    expires_at
  )
  values (
    p_payment_address,
    p_ordinals_address,
    p_block_numbers,
    p_amount_sats,
    p_receiver_address,
    'pending',
    v_expires_at
  )
  returning id
  into v_order_id;

  update public.blocks
  set
    status = 'reserved',
    reservation_order_id = v_order_id,
    reservation_expires_at = v_expires_at
  where
    block_number =
      any(p_block_numbers);

  return query
  select
    v_order_id,
    v_expires_at;
end;
$$;


ALTER FUNCTION "public"."reserve_claim_blocks"("p_payment_address" "text", "p_ordinals_address" "text", "p_block_numbers" smallint[], "p_amount_sats" bigint, "p_receiver_address" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_owned_blocks"("p_payment_address" "text", "p_blocks" "jsonb") RETURNS TABLE("block_number" smallint, "block_row" smallint, "block_column" smallint, "owner_payment_address" "text", "pixels" "text"[], "description" "text", "claimed_at" timestamp with time zone, "updated_at" timestamp with time zone, "claim_transaction_id" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
declare
  v_requested_count integer;
  v_owned_count integer;
  v_unique_count integer;

  v_block jsonb;
  v_block_number smallint;
  v_pixels text[];
  v_description text;
begin
  if (
    p_payment_address is null
    or btrim(p_payment_address) = ''
  ) then
    raise exception
      'A payment address is required.';
  end if;

  if (
    p_blocks is null
    or jsonb_typeof(p_blocks) <> 'array'
  ) then
    raise exception
      'The Blocks payload must be an array.';
  end if;

  v_requested_count =
    jsonb_array_length(p_blocks);

  if v_requested_count = 0 then
    raise exception
      'At least one Block is required.';
  end if;

  if v_requested_count > 100 then
    raise exception
      'A maximum of 100 Blocks may be saved.';
  end if;

  select count(
    distinct
    (item.value ->> 'blockNumber')::integer
  )
  into v_unique_count
  from jsonb_array_elements(p_blocks)
    as item(value);

  if v_unique_count <> v_requested_count then
    raise exception
      'The Blocks payload contains duplicates.';
  end if;

  perform stored_blocks.block_number
  from public.blocks as stored_blocks
  where stored_blocks.block_number in (
    select
      (item.value ->> 'blockNumber')::smallint
    from jsonb_array_elements(p_blocks)
      as item(value)
  )
  order by stored_blocks.block_number
  for update;

  select count(*)
  into v_owned_count
  from public.blocks as stored_blocks
  where
    stored_blocks.block_number in (
      select
        (item.value ->> 'blockNumber')::smallint
      from jsonb_array_elements(p_blocks)
        as item(value)
    )
    and stored_blocks.status = 'claimed'
    and stored_blocks.owner_payment_address =
      p_payment_address;

  if v_owned_count <> v_requested_count then
    raise exception
      'One or more Blocks are not owned by this wallet.';
  end if;

  for v_block in
    select item.value
    from jsonb_array_elements(p_blocks)
      as item(value)
  loop
    v_block_number =
      (v_block ->> 'blockNumber')::smallint;

    select array_agg(
      pixel.color
      order by pixel.position
    )
    into v_pixels
    from jsonb_array_elements_text(
      v_block -> 'pixels'
    )
    with ordinality
      as pixel(color, position);

    if cardinality(v_pixels) <> 256 then
      raise exception
        'Every Block must contain exactly 256 Pixels.';
    end if;

    if exists (
      select 1
      from unnest(v_pixels)
        as colour(value)
      where colour.value
        !~ '^#[0-9a-fA-F]{6}$'
    ) then
      raise exception
        'One or more Pixel colours are invalid.';
    end if;

    v_description =
      nullif(
        btrim(
          coalesce(
            v_block ->> 'description',
            ''
          )
        ),
        ''
      );

    if char_length(
      coalesce(v_description, '')
    ) > 300 then
      raise exception
        'A Block description cannot exceed 300 characters.';
    end if;

    update public.blocks
      as block_to_update
    set
      pixels = v_pixels,
      description = v_description
    where
      block_to_update.block_number =
        v_block_number;
  end loop;

  return query
  select
    stored_blocks.block_number,
    stored_blocks.block_row,
    stored_blocks.block_column,
    stored_blocks.owner_payment_address,
    stored_blocks.pixels,
    stored_blocks.description,
    stored_blocks.claimed_at,
    stored_blocks.updated_at,
    stored_blocks.claim_transaction_id
  from public.blocks
    as stored_blocks
  where
    stored_blocks.block_number in (
      select
        (item.value ->> 'blockNumber')::smallint
      from jsonb_array_elements(p_blocks)
        as item(value)
    )
  order by
    stored_blocks.block_number;
end;
$_$;


ALTER FUNCTION "public"."save_owned_blocks"("p_payment_address" "text", "p_blocks" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."blocks" (
    "block_number" smallint NOT NULL,
    "block_row" smallint NOT NULL,
    "block_column" smallint NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "owner_payment_address" "text",
    "owner_ordinals_address" "text",
    "pixels" "text"[],
    "description" "text",
    "claimed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "claim_transaction_id" "text",
    "reservation_order_id" "uuid",
    "reservation_expires_at" timestamp with time zone,
    CONSTRAINT "blocks_block_column_check" CHECK ((("block_column" >= 0) AND ("block_column" <= 63))),
    CONSTRAINT "blocks_block_number_check" CHECK ((("block_number" >= 1) AND ("block_number" <= 4096))),
    CONSTRAINT "blocks_block_row_check" CHECK ((("block_row" >= 0) AND ("block_row" <= 63))),
    CONSTRAINT "blocks_description_check" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 300))),
    CONSTRAINT "blocks_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'reserved'::"text", 'claimed'::"text"]))),
    CONSTRAINT "blocks_valid_state" CHECK (((("status" = 'available'::"text") AND ("reservation_order_id" IS NULL) AND ("reservation_expires_at" IS NULL) AND ("owner_payment_address" IS NULL) AND ("owner_ordinals_address" IS NULL) AND ("claim_transaction_id" IS NULL)) OR (("status" = 'reserved'::"text") AND ("reservation_order_id" IS NOT NULL) AND ("reservation_expires_at" IS NOT NULL) AND ("owner_payment_address" IS NULL) AND ("owner_ordinals_address" IS NULL) AND ("claim_transaction_id" IS NULL)) OR (("status" = 'claimed'::"text") AND ("reservation_order_id" IS NULL) AND ("reservation_expires_at" IS NULL) AND ("owner_payment_address" IS NOT NULL) AND ("owner_ordinals_address" IS NOT NULL) AND ("pixels" IS NOT NULL) AND ("cardinality"("pixels") = 256) AND ("claimed_at" IS NOT NULL) AND ("claim_transaction_id" IS NOT NULL))))
);


ALTER TABLE "public"."blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."claim_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_address" "text" NOT NULL,
    "ordinals_address" "text" NOT NULL,
    "block_numbers" smallint[] NOT NULL,
    "amount_sats" bigint NOT NULL,
    "receiver_address" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_txid" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "claim_orders_amount_sats_check" CHECK (("amount_sats" > 0)),
    CONSTRAINT "claim_orders_has_blocks" CHECK (("cardinality"("block_numbers") > 0)),
    CONSTRAINT "claim_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'expired'::"text", 'cancelled'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."claim_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_auth_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_address" "text" NOT NULL,
    "ordinals_address" "text" NOT NULL,
    "message" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallet_auth_challenge_expiry" CHECK (("expires_at" > "created_at"))
);


ALTER TABLE "public"."wallet_auth_challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallet_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_address" "text" NOT NULL,
    "ordinals_address" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallet_session_expiry" CHECK (("expires_at" > "created_at"))
);


ALTER TABLE "public"."wallet_sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_claim_transaction_id_key" UNIQUE ("claim_transaction_id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("block_number");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_unique_coordinate" UNIQUE ("block_row", "block_column");



ALTER TABLE ONLY "public"."claim_orders"
    ADD CONSTRAINT "claim_orders_payment_txid_key" UNIQUE ("payment_txid");



ALTER TABLE ONLY "public"."claim_orders"
    ADD CONSTRAINT "claim_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_auth_challenges"
    ADD CONSTRAINT "wallet_auth_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_sessions"
    ADD CONSTRAINT "wallet_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallet_sessions"
    ADD CONSTRAINT "wallet_sessions_token_hash_key" UNIQUE ("token_hash");



CREATE INDEX "blocks_reservation_expiry_index" ON "public"."blocks" USING "btree" ("reservation_expires_at") WHERE ("status" = 'reserved'::"text");



CREATE INDEX "blocks_status_index" ON "public"."blocks" USING "btree" ("status");



CREATE INDEX "claim_orders_status_expiry_index" ON "public"."claim_orders" USING "btree" ("status", "expires_at");



CREATE INDEX "wallet_auth_challenges_address_index" ON "public"."wallet_auth_challenges" USING "btree" ("payment_address");



CREATE INDEX "wallet_auth_challenges_expiry_index" ON "public"."wallet_auth_challenges" USING "btree" ("expires_at");



CREATE INDEX "wallet_sessions_address_index" ON "public"."wallet_sessions" USING "btree" ("payment_address");



CREATE INDEX "wallet_sessions_expiry_index" ON "public"."wallet_sessions" USING "btree" ("expires_at");



CREATE OR REPLACE TRIGGER "blocks_set_updated_at" BEFORE UPDATE ON "public"."blocks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "claim_orders_set_updated_at" BEFORE UPDATE ON "public"."claim_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_reservation_order_id_fkey" FOREIGN KEY ("reservation_order_id") REFERENCES "public"."claim_orders"("id") ON DELETE SET NULL;



CREATE POLICY "Public can read the Board" ON "public"."blocks" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."claim_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_auth_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallet_sessions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_claim_order"("p_order_id" "uuid", "p_payment_address" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_claim_order"("p_order_id" "uuid", "p_payment_address" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirm_claim_order_simulated"("p_order_id" "uuid", "p_payment_address" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_claim_order_simulated"("p_order_id" "uuid", "p_payment_address" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_wallet_session"("p_challenge_id" "uuid", "p_session_token_hash" "text", "p_session_expires_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_wallet_session"("p_challenge_id" "uuid", "p_session_token_hash" "text", "p_session_expires_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_claim_blocks"("p_payment_address" "text", "p_ordinals_address" "text", "p_block_numbers" smallint[], "p_amount_sats" bigint, "p_receiver_address" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_claim_blocks"("p_payment_address" "text", "p_ordinals_address" "text", "p_block_numbers" smallint[], "p_amount_sats" bigint, "p_receiver_address" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_owned_blocks"("p_payment_address" "text", "p_blocks" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_owned_blocks"("p_payment_address" "text", "p_blocks" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."blocks" TO "service_role";



GRANT SELECT("block_number") ON TABLE "public"."blocks" TO "anon";
GRANT SELECT("block_number") ON TABLE "public"."blocks" TO "authenticated";



GRANT SELECT("block_row") ON TABLE "public"."blocks" TO "anon";
GRANT SELECT("block_row") ON TABLE "public"."blocks" TO "authenticated";



GRANT SELECT("block_column") ON TABLE "public"."blocks" TO "anon";
GRANT SELECT("block_column") ON TABLE "public"."blocks" TO "authenticated";



GRANT SELECT("status") ON TABLE "public"."blocks" TO "anon";
GRANT SELECT("status") ON TABLE "public"."blocks" TO "authenticated";



GRANT SELECT("owner_payment_address") ON TABLE "public"."blocks" TO "anon";
GRANT SELECT("owner_payment_address") ON TABLE "public"."blocks" TO "authenticated";



GRANT SELECT("pixels") ON TABLE "public"."blocks" TO "anon";
GRANT SELECT("pixels") ON TABLE "public"."blocks" TO "authenticated";



GRANT SELECT("description") ON TABLE "public"."blocks" TO "anon";
GRANT SELECT("description") ON TABLE "public"."blocks" TO "authenticated";



GRANT SELECT("claimed_at") ON TABLE "public"."blocks" TO "anon";
GRANT SELECT("claimed_at") ON TABLE "public"."blocks" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."blocks" TO "anon";
GRANT SELECT("updated_at") ON TABLE "public"."blocks" TO "authenticated";



GRANT SELECT("claim_transaction_id") ON TABLE "public"."blocks" TO "anon";
GRANT SELECT("claim_transaction_id") ON TABLE "public"."blocks" TO "authenticated";



GRANT ALL ON TABLE "public"."claim_orders" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_auth_challenges" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_sessions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








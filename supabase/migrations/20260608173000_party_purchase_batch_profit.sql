-- Party completed purchases, stock batch tracking, and batch profit/loss.
-- Safe to run after 20260603110000_adjust_product_stock_rpc.sql.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.product_stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  party_purchase_id UUID REFERENCES public.party_purchases(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'party_transfer' CHECK (source IN ('party_transfer', 'manual', 'opening')),
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  quantity_remaining INTEGER NOT NULL CHECK (quantity_remaining >= 0),
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT product_stock_batches_remaining_check
    CHECK (quantity_remaining <= quantity_received)
);

CREATE INDEX IF NOT EXISTS idx_product_stock_batches_product_id
  ON public.product_stock_batches(product_id);

CREATE INDEX IF NOT EXISTS idx_product_stock_batches_party_purchase_id
  ON public.product_stock_batches(party_purchase_id);

CREATE INDEX IF NOT EXISTS idx_product_stock_batches_fifo
  ON public.product_stock_batches(product_id, created_at, id)
  WHERE quantity_remaining > 0;

CREATE TABLE IF NOT EXISTS public.sale_batch_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.product_stock_batches(id) ON DELETE SET NULL,
  party_purchase_id UUID REFERENCES public.party_purchases(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  profit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_batch_allocations_sale_id
  ON public.sale_batch_allocations(sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_batch_allocations_party_purchase_id
  ON public.sale_batch_allocations(party_purchase_id);

CREATE TABLE IF NOT EXISTS public.party_purchase_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_purchase_id UUID NOT NULL REFERENCES public.party_purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('transfer_to_product', 'deducted', 'gifted', 'adjustment')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_party_purchase_movements_party_purchase_id
  ON public.party_purchase_movements(party_purchase_id);

CREATE INDEX IF NOT EXISTS idx_party_purchase_movements_created_at
  ON public.party_purchase_movements(created_at DESC);

ALTER TABLE public.product_stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_batch_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_purchase_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read product stock batches"
  ON public.product_stock_batches;
CREATE POLICY "Authenticated users can read product stock batches"
  ON public.product_stock_batches
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert product stock batches"
  ON public.product_stock_batches;
CREATE POLICY "Authenticated users can insert product stock batches"
  ON public.product_stock_batches
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read sale batch allocations"
  ON public.sale_batch_allocations;
CREATE POLICY "Authenticated users can read sale batch allocations"
  ON public.sale_batch_allocations
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert sale batch allocations"
  ON public.sale_batch_allocations;
CREATE POLICY "Authenticated users can insert sale batch allocations"
  ON public.sale_batch_allocations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read party purchase movements"
  ON public.party_purchase_movements;
CREATE POLICY "Authenticated users can read party purchase movements"
  ON public.party_purchase_movements
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert party purchase movements"
  ON public.party_purchase_movements;
CREATE POLICY "Authenticated users can insert party purchase movements"
  ON public.party_purchase_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.record_party_transfer_batch(
  p_party_purchase_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_unit_cost NUMERIC,
  p_unit_price NUMERIC,
  p_movement_date DATE DEFAULT CURRENT_DATE,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  created_batch_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be greater than zero';
  END IF;

  INSERT INTO public.product_stock_batches (
    product_id,
    party_purchase_id,
    source,
    quantity_received,
    quantity_remaining,
    unit_cost,
    received_at,
    metadata
  ) VALUES (
    p_product_id,
    p_party_purchase_id,
    'party_transfer',
    p_quantity,
    p_quantity,
    COALESCE(p_unit_cost, 0),
    COALESCE(p_movement_date, CURRENT_DATE),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO created_batch_id;

  INSERT INTO public.party_purchase_movements (
    party_purchase_id,
    product_id,
    action,
    quantity,
    unit_cost,
    unit_price,
    movement_date,
    reason,
    metadata
  ) VALUES (
    p_party_purchase_id,
    p_product_id,
    'transfer_to_product',
    p_quantity,
    COALESCE(p_unit_cost, 0),
    COALESCE(p_unit_price, 0),
    COALESCE(p_movement_date, CURRENT_DATE),
    p_reason,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('batch_id', created_batch_id)
  );

  RETURN created_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.allocate_sale_to_stock_batches(
  p_sale_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_unit_price NUMERIC
)
RETURNS VOID AS $$
DECLARE
  quantity_left INTEGER := p_quantity;
  batch_record RECORD;
  allocated_quantity INTEGER;
  fallback_unit_cost NUMERIC(12, 2);
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN;
  END IF;

  FOR batch_record IN
    SELECT id, party_purchase_id, quantity_remaining, unit_cost
    FROM public.product_stock_batches
    WHERE product_id = p_product_id
      AND quantity_remaining > 0
    ORDER BY created_at ASC, id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN quantity_left <= 0;

    allocated_quantity := LEAST(quantity_left, batch_record.quantity_remaining);

    UPDATE public.product_stock_batches
    SET quantity_remaining = quantity_remaining - allocated_quantity,
        updated_at = NOW()
    WHERE id = batch_record.id;

    INSERT INTO public.sale_batch_allocations (
      sale_id,
      product_id,
      batch_id,
      party_purchase_id,
      quantity,
      unit_cost,
      unit_price,
      profit
    ) VALUES (
      p_sale_id,
      p_product_id,
      batch_record.id,
      batch_record.party_purchase_id,
      allocated_quantity,
      COALESCE(batch_record.unit_cost, 0),
      COALESCE(p_unit_price, 0),
      (COALESCE(p_unit_price, 0) - COALESCE(batch_record.unit_cost, 0)) * allocated_quantity
    );

    quantity_left := quantity_left - allocated_quantity;
  END LOOP;

  IF quantity_left > 0 THEN
    SELECT COALESCE(purchase_price, 0) INTO fallback_unit_cost
    FROM public.products
    WHERE id = p_product_id;

    INSERT INTO public.sale_batch_allocations (
      sale_id,
      product_id,
      batch_id,
      party_purchase_id,
      quantity,
      unit_cost,
      unit_price,
      profit
    ) VALUES (
      p_sale_id,
      p_product_id,
      NULL,
      NULL,
      quantity_left,
      COALESCE(fallback_unit_cost, 0),
      COALESCE(p_unit_price, 0),
      (COALESCE(p_unit_price, 0) - COALESCE(fallback_unit_cost, 0)) * quantity_left
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.restore_sale_batch_allocations(
  p_sale_id UUID
)
RETURNS VOID AS $$
DECLARE
  allocation_record RECORD;
BEGIN
  FOR allocation_record IN
    SELECT id, batch_id, quantity
    FROM public.sale_batch_allocations
    WHERE sale_id = p_sale_id
      AND batch_id IS NOT NULL
    FOR UPDATE
  LOOP
    UPDATE public.product_stock_batches
    SET quantity_remaining = quantity_remaining + allocation_record.quantity,
        updated_at = NOW()
    WHERE id = allocation_record.batch_id;
  END LOOP;

  DELETE FROM public.sale_batch_allocations
  WHERE sale_id = p_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.apply_stock_for_sale_insert()
RETURNS TRIGGER AS $$
DECLARE
  stock_before INTEGER;
  stock_after INTEGER;
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'Sale quantity must be greater than zero';
  END IF;

  NEW.updated_at := COALESCE(NEW.updated_at, NOW());

  SELECT stock_quantity INTO stock_before
  FROM public.products
  WHERE id = NEW.product_id
  FOR UPDATE;

  IF stock_before IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF stock_before < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', stock_before, NEW.quantity;
  END IF;

  stock_after := stock_before - NEW.quantity;

  UPDATE public.products
  SET stock_quantity = stock_after,
      updated_at = NOW()
  WHERE id = NEW.product_id;

  PERFORM public.write_inventory_ledger(
    NEW.product_id,
    NEW.id,
    'sale_created',
    -NEW.quantity,
    stock_before,
    stock_after,
    'sales_trigger',
    NEW.notes,
    jsonb_build_object('sale_date', NEW.sale_date, 'unit_price', NEW.unit_price)
  );

  PERFORM public.allocate_sale_to_stock_batches(NEW.id, NEW.product_id, NEW.quantity, NEW.unit_price);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.apply_stock_for_sale_update()
RETURNS TRIGGER AS $$
DECLARE
  quantity_diff INTEGER;
  stock_before INTEGER;
  stock_after INTEGER;
BEGIN
  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'Sale quantity must be greater than zero';
  END IF;

  NEW.updated_at := NOW();

  PERFORM public.restore_sale_batch_allocations(OLD.id);

  IF NEW.product_id = OLD.product_id THEN
    quantity_diff := NEW.quantity - OLD.quantity;

    IF quantity_diff <> 0 THEN
      SELECT stock_quantity INTO stock_before
      FROM public.products
      WHERE id = NEW.product_id
      FOR UPDATE;

      IF stock_before IS NULL THEN
        RAISE EXCEPTION 'Product not found';
      END IF;

      IF quantity_diff > 0 AND stock_before < quantity_diff THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Required: %', stock_before, quantity_diff;
      END IF;

      stock_after := stock_before - quantity_diff;

      UPDATE public.products
      SET stock_quantity = stock_after,
          updated_at = NOW()
      WHERE id = NEW.product_id;

      PERFORM public.write_inventory_ledger(
        NEW.product_id,
        NEW.id,
        CASE WHEN quantity_diff > 0 THEN 'sale_quantity_increased' ELSE 'sale_quantity_decreased' END,
        -quantity_diff,
        stock_before,
        stock_after,
        'sales_trigger',
        NEW.notes,
        jsonb_build_object('old_quantity', OLD.quantity, 'new_quantity', NEW.quantity)
      );
    END IF;

    PERFORM public.allocate_sale_to_stock_batches(NEW.id, NEW.product_id, NEW.quantity, NEW.unit_price);
    RETURN NEW;
  END IF;

  SELECT stock_quantity INTO stock_before
  FROM public.products
  WHERE id = OLD.product_id
  FOR UPDATE;

  IF stock_before IS NOT NULL THEN
    stock_after := stock_before + OLD.quantity;
    UPDATE public.products
    SET stock_quantity = stock_after,
        updated_at = NOW()
    WHERE id = OLD.product_id;

    PERFORM public.write_inventory_ledger(
      OLD.product_id,
      NEW.id,
      'sale_product_changed_restore',
      OLD.quantity,
      stock_before,
      stock_after,
      'sales_trigger',
      NEW.notes,
      jsonb_build_object('new_product_id', NEW.product_id)
    );
  END IF;

  SELECT stock_quantity INTO stock_before
  FROM public.products
  WHERE id = NEW.product_id
  FOR UPDATE;

  IF stock_before IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF stock_before < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', stock_before, NEW.quantity;
  END IF;

  stock_after := stock_before - NEW.quantity;

  UPDATE public.products
  SET stock_quantity = stock_after,
      updated_at = NOW()
  WHERE id = NEW.product_id;

  PERFORM public.write_inventory_ledger(
    NEW.product_id,
    NEW.id,
    'sale_product_changed_deduct',
    -NEW.quantity,
    stock_before,
    stock_after,
    'sales_trigger',
    NEW.notes,
    jsonb_build_object('old_product_id', OLD.product_id)
  );

  PERFORM public.allocate_sale_to_stock_batches(NEW.id, NEW.product_id, NEW.quantity, NEW.unit_price);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.apply_stock_for_sale_delete()
RETURNS TRIGGER AS $$
DECLARE
  stock_before INTEGER;
  stock_after INTEGER;
BEGIN
  PERFORM public.restore_sale_batch_allocations(OLD.id);

  SELECT stock_quantity INTO stock_before
  FROM public.products
  WHERE id = OLD.product_id
  FOR UPDATE;

  IF stock_before IS NULL THEN
    RETURN OLD;
  END IF;

  stock_after := stock_before + OLD.quantity;

  UPDATE public.products
  SET stock_quantity = stock_after,
      updated_at = NOW()
  WHERE id = OLD.product_id;

  PERFORM public.write_inventory_ledger(
    OLD.product_id,
    OLD.id,
    'sale_deleted_restore',
    OLD.quantity,
    stock_before,
    stock_after,
    'sales_trigger',
    OLD.notes,
    jsonb_build_object('sale_date', OLD.sale_date)
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  p_product_id UUID,
  p_mode TEXT,
  p_quantity INTEGER DEFAULT NULL,
  p_target_stock INTEGER DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_adjustment_date DATE DEFAULT CURRENT_DATE,
  p_party_purchase_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  stock_before INTEGER;
  stock_after INTEGER;
  quantity_change INTEGER;
  action_name TEXT;
  party_purchase_record public.party_purchases%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Adjustment reason is required';
  END IF;

  SELECT stock_quantity INTO stock_before
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF stock_before IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF p_mode = 'correction' THEN
    IF p_target_stock IS NULL OR p_target_stock < 0 THEN
      RAISE EXCEPTION 'Corrected stock must be zero or more';
    END IF;
    stock_after := p_target_stock;
    quantity_change := stock_after - stock_before;
    action_name := 'stock_repair';
  ELSE
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    IF p_mode = 'add' THEN
      quantity_change := p_quantity;
      stock_after := stock_before + p_quantity;
      action_name := 'manual_stock_added';
    ELSIF p_mode = 'party_transfer' THEN
      IF p_party_purchase_id IS NULL THEN
        RAISE EXCEPTION 'Party purchase is required for transfer';
      END IF;

      SELECT * INTO party_purchase_record
      FROM public.party_purchases
      WHERE id = p_party_purchase_id
      FOR UPDATE;

      IF party_purchase_record.id IS NULL THEN
        RAISE EXCEPTION 'Party purchase not found';
      END IF;

      IF party_purchase_record.remaining_quantity < p_quantity THEN
        RAISE EXCEPTION 'Cannot transfer more than party stock. Available: %, Requested: %',
          party_purchase_record.remaining_quantity,
          p_quantity;
      END IF;

      UPDATE public.party_purchases
      SET remaining_quantity = remaining_quantity - p_quantity,
          updated_at = NOW()
      WHERE id = p_party_purchase_id;

      quantity_change := p_quantity;
      stock_after := stock_before + p_quantity;
      action_name := 'party_transfer';
    ELSIF p_mode = 'reduce' THEN
      quantity_change := -p_quantity;
      stock_after := stock_before - p_quantity;
      action_name := 'manual_stock_reduced';
    ELSIF p_mode = 'damaged' THEN
      quantity_change := -p_quantity;
      stock_after := stock_before - p_quantity;
      action_name := 'damaged_stock_removed';
    ELSE
      RAISE EXCEPTION 'Unsupported adjustment mode: %', p_mode;
    END IF;
  END IF;

  IF stock_after < 0 THEN
    RAISE EXCEPTION 'Cannot reduce below zero. Available: %, Requested: %', stock_before, abs(quantity_change);
  END IF;

  UPDATE public.products
  SET stock_quantity = stock_after,
      updated_at = NOW()
  WHERE id = p_product_id;

  IF p_mode = 'party_transfer' THEN
    PERFORM public.record_party_transfer_batch(
      p_party_purchase_id,
      p_product_id,
      p_quantity,
      party_purchase_record.purchase_price,
      party_purchase_record.selling_price,
      p_adjustment_date,
      trim(p_reason),
      jsonb_build_object('party_name', party_purchase_record.party_name)
    );
  END IF;

  PERFORM public.write_inventory_ledger(
    p_product_id,
    NULL,
    action_name,
    quantity_change,
    stock_before,
    stock_after,
    'stock_adjustment_rpc',
    trim(p_reason),
    jsonb_build_object(
      'mode', p_mode,
      'adjustment_date', p_adjustment_date,
      'party_purchase_id', p_party_purchase_id
    )
  );

  RETURN json_build_object(
    'success', true,
    'product_id', p_product_id,
    'stock_before', stock_before,
    'stock_after', stock_after,
    'quantity_change', quantity_change,
    'action', action_name
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_party_purchase_deduction(
  p_party_purchase_id UUID,
  p_quantity INTEGER,
  p_movement_date DATE DEFAULT CURRENT_DATE,
  p_reason TEXT DEFAULT NULL,
  p_action TEXT DEFAULT 'deducted',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSON AS $$
DECLARE
  party_purchase_record public.party_purchases%ROWTYPE;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Deduction quantity must be greater than zero';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  IF p_action NOT IN ('deducted', 'gifted') THEN
    RAISE EXCEPTION 'Unsupported party deduction action: %', p_action;
  END IF;

  SELECT * INTO party_purchase_record
  FROM public.party_purchases
  WHERE id = p_party_purchase_id
  FOR UPDATE;

  IF party_purchase_record.id IS NULL THEN
    RAISE EXCEPTION 'Party purchase not found';
  END IF;

  IF party_purchase_record.remaining_quantity < p_quantity THEN
    RAISE EXCEPTION 'Cannot deduct more than party stock. Available: %, Requested: %',
      party_purchase_record.remaining_quantity,
      p_quantity;
  END IF;

  UPDATE public.party_purchases
  SET remaining_quantity = remaining_quantity - p_quantity,
      updated_at = NOW()
  WHERE id = p_party_purchase_id
  RETURNING * INTO party_purchase_record;

  INSERT INTO public.party_purchase_movements (
    party_purchase_id,
    product_id,
    action,
    quantity,
    unit_cost,
    unit_price,
    movement_date,
    reason,
    metadata
  ) VALUES (
    p_party_purchase_id,
    NULL,
    p_action,
    p_quantity,
    COALESCE(party_purchase_record.purchase_price, 0),
    COALESCE(party_purchase_record.selling_price, 0),
    COALESCE(p_movement_date, CURRENT_DATE),
    trim(p_reason),
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN json_build_object(
    'success', true,
    'party_purchase_id', p_party_purchase_id,
    'remaining_quantity', party_purchase_record.remaining_quantity
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_party_transfer_batch(
  UUID, UUID, INTEGER, NUMERIC, NUMERIC, DATE, TEXT, JSONB
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.allocate_sale_to_stock_batches(
  UUID, UUID, INTEGER, NUMERIC
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.restore_sale_batch_allocations(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.adjust_product_stock(
  UUID, TEXT, INTEGER, INTEGER, TEXT, DATE, UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.record_party_purchase_deduction(
  UUID, INTEGER, DATE, TEXT, TEXT, JSONB
) TO authenticated;

COMMIT;

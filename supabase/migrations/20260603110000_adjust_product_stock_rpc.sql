-- Atomic product stock adjustment RPC.
-- Safe to run more than once in Supabase SQL Editor or Supabase CLI.

BEGIN;

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
  party_remaining INTEGER;
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

      SELECT remaining_quantity INTO party_remaining
      FROM public.party_purchases
      WHERE id = p_party_purchase_id
      FOR UPDATE;

      IF party_remaining IS NULL THEN
        RAISE EXCEPTION 'Party purchase not found';
      END IF;

      IF party_remaining < p_quantity THEN
        RAISE EXCEPTION 'Cannot transfer more than party stock. Available: %, Requested: %', party_remaining, p_quantity;
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

GRANT EXECUTE ON FUNCTION public.adjust_product_stock(
  UUID, TEXT, INTEGER, INTEGER, TEXT, DATE, UUID
) TO authenticated;

COMMIT;

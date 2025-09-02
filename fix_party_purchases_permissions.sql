-- Fix party_purchases table permissions to allow anonymous access
-- This matches the permission pattern used by products table

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON party_purchases;
DROP POLICY IF EXISTS "Allow all operations for all users" ON party_purchases;

-- Create new policies matching products table pattern
CREATE POLICY "Anyone can view party purchases" ON party_purchases
    FOR SELECT USING (true);

CREATE POLICY "Anyone can create party purchases" ON party_purchases
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update party purchases" ON party_purchases
    FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete party purchases" ON party_purchases
    FOR DELETE USING (true);

-- Note: In a production environment, you should implement proper authentication
-- and restrict these permissions based on user roles
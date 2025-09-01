-- Create party_purchases table
CREATE TABLE IF NOT EXISTS party_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  party_name TEXT NOT NULL,
  item_name TEXT NOT NULL,
  barcode TEXT,
  purchase_price DECIMAL(10,2) NOT NULL,
  selling_price DECIMAL(10,2) NOT NULL,
  purchased_quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL,
  purchase_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create RLS policies for party_purchases
ALTER TABLE party_purchases ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON party_purchases
    FOR ALL USING (auth.role() = 'authenticated');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_party_purchases_updated_at BEFORE UPDATE ON party_purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
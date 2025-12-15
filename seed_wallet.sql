-- Run this to seed the wallet for testing
-- Ensure the wallet exists first, insert if not (although likely exists)
INSERT INTO agent_wallets (agent_id, balance, lifetime_commission)
VALUES (1, 30000, 30000)
ON CONFLICT (agent_id) 
DO UPDATE SET balance = 30000;

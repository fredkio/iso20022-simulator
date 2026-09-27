-- ========================================================================
-- ISO 20022 MULTI-BANK TRANSACTION SIMULATION ENVIRONMENT
-- Supabase / PostgreSQL Consolidated DDL & Initial Participant Seeding
-- Project: https://fqycspmoapmisnbfhukn.supabase.co
-- ========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================================
-- 1. PARTICIPANT REGISTRY (Central Switch Directory)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.participants (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(16) UNIQUE NOT NULL,             -- e.g. NAIJANG, METRNG
    name VARCHAR(255) NOT NULL,                   -- e.g. Naija Bank, Metro Bank
    routing_code VARCHAR(16) NOT NULL,            -- e.g. 011, 033
    status VARCHAR(16) DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'DEGRADED', 'SUSPENDED')),
    brand_color VARCHAR(16) DEFAULT '#059669',
    accent_color VARCHAR(16) DEFAULT '#10B981',
    endpoint VARCHAR(255) NOT NULL,
    supported_messages JSONB DEFAULT '["acmt.023.001.03", "acmt.024.001.03", "pacs.008.001.10", "pacs.002.001.12"]'::jsonb,
    capabilities JSONB DEFAULT '{"instantTransfer": true, "directDebit": true, "requestToPay": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================================
-- 2. CORE CUSTOMERS & ACCOUNTS (Logical Multi-Tenant Institutional Isolation)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) REFERENCES public.participants(id) ON DELETE RESTRICT,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(32),
    status VARCHAR(16) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accounts (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) REFERENCES public.participants(id) ON DELETE RESTRICT,
    customer_id VARCHAR(64) REFERENCES public.customers(id) ON DELETE CASCADE,
    account_number VARCHAR(32) UNIQUE NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(32) DEFAULT 'SAVINGS' CHECK (account_type IN ('SAVINGS', 'CURRENT', 'CORPORATE')),
    available_balance NUMERIC(18, 2) DEFAULT 0.00 NOT NULL,
    ledger_balance NUMERIC(18, 2) DEFAULT 0.00 NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN' NOT NULL,
    status VARCHAR(16) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DORMANT', 'FROZEN', 'CLOSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accounts_inst_num ON public.accounts(institution_id, account_number);

-- ========================================================================
-- 3. DOUBLE-ENTRY GENERAL LEDGER (Asset & Liability Balances)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) REFERENCES public.participants(id) ON DELETE RESTRICT,
    code VARCHAR(32) NOT NULL,                    -- 1010-CUST-DEP, 1020-SETTLE-CLR
    name VARCHAR(255) NOT NULL,
    type VARCHAR(16) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY')),
    balance NUMERIC(18, 2) DEFAULT 0.00 NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id VARCHAR(64) PRIMARY KEY,
    institution_id VARCHAR(64) REFERENCES public.participants(id) ON DELETE RESTRICT,
    transaction_id VARCHAR(64) NOT NULL,
    reference VARCHAR(64) NOT NULL,
    description TEXT,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.journal_lines (
    id VARCHAR(64) PRIMARY KEY,
    journal_entry_id VARCHAR(64) REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    ledger_account_id VARCHAR(64) REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
    direction VARCHAR(6) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    amount NUMERIC(18, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================================================
-- 4. HYBRID ISO 20022 MESSAGE STORE (Raw XML + Parsed JSON + Normalised)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.iso_messages (
    id VARCHAR(64) PRIMARY KEY,
    business_journey_id VARCHAR(64) NOT NULL,
    transaction_id VARCHAR(64) NOT NULL,
    message_type VARCHAR(32) NOT NULL,            -- pacs.008.001.10, acmt.023.001.03, etc.
    message_version VARCHAR(16) NOT NULL,
    message_id VARCHAR(64) UNIQUE NOT NULL,
    original_message_id VARCHAR(64),
    sender_bic VARCHAR(16) NOT NULL,
    receiver_bic VARCHAR(16) NOT NULL,
    
    -- Hybrid Storage
    raw_xml TEXT NOT NULL,                        -- Complete unmodified XML payload
    parsed_json JSONB NOT NULL,                   -- Complete parsed hierarchical JSON
    
    -- Queryable Normalised Fields
    uetr VARCHAR(64),
    instruction_id VARCHAR(64),
    end_to_end_id VARCHAR(64),
    amount NUMERIC(18, 2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'NGN',
    debtor_agent VARCHAR(16),
    creditor_agent VARCHAR(16),
    settlement_date DATE,
    
    schema_validation_status VARCHAR(8) DEFAULT 'PASS',
    business_validation_status VARCHAR(8) DEFAULT 'PASS',
    processing_status VARCHAR(16) DEFAULT 'PROCESSED',
    validation_results JSONB DEFAULT '[]'::jsonb,
    
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_iso_journey_id ON public.iso_messages(business_journey_id);
CREATE INDEX IF NOT EXISTS idx_iso_uetr ON public.iso_messages(uetr);
CREATE INDEX IF NOT EXISTS idx_iso_msg_id ON public.iso_messages(message_id);

-- ========================================================================
-- 5. CANONICAL PAYMENT TRANSACTIONS
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id VARCHAR(64) PRIMARY KEY,
    business_journey_id VARCHAR(64) NOT NULL,
    uetr VARCHAR(64) UNIQUE NOT NULL,
    instruction_id VARCHAR(64) NOT NULL,
    end_to_end_id VARCHAR(64) NOT NULL,
    tx_id VARCHAR(64) NOT NULL,
    originating_institution_id VARCHAR(64) REFERENCES public.participants(id),
    destination_institution_id VARCHAR(64) REFERENCES public.participants(id),
    debtor_account VARCHAR(32) NOT NULL,
    debtor_name VARCHAR(255) NOT NULL,
    creditor_account VARCHAR(32) NOT NULL,
    creditor_name VARCHAR(255) NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    local_instrument VARCHAR(16) DEFAULT 'INST',
    status VARCHAR(32) NOT NULL,                  -- PENDING, COMPLETED, REJECTED, FAILED
    status_reason_code VARCHAR(16),               -- ACTC, AC01, AM04, DS04
    status_reason_desc TEXT,
    latency_ms INT,
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ========================================================================
-- 6. TRANSACTION EVENTS & AUDIT LOG
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.transaction_events (
    id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL,
    business_journey_id VARCHAR(64) NOT NULL,
    event_code VARCHAR(64) NOT NULL,
    actor VARCHAR(64) NOT NULL,
    stage VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL,
    description TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    sequence_no INT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_tx_id ON public.transaction_events(transaction_id);

-- ========================================================================
-- 7. INITIAL SEED DATA (5 SYNTHETIC BANKS, CUSTOMERS, & LEDGERS)
-- ========================================================================
INSERT INTO public.participants (id, code, name, routing_code, status, brand_color, accent_color, endpoint)
VALUES
    ('bank-a', 'NAIJANG', 'Naija Bank', '011', 'ONLINE', '#059669', '#10B981', '/api/banks/NAIJANG/inbound'),
    ('bank-b', 'UNITNG', 'Unity Bank', '022', 'ONLINE', '#1D4ED8', '#3B82F6', '/api/banks/UNITNG/inbound'),
    ('bank-c', 'METRNG', 'Metro Bank', '033', 'ONLINE', '#E11D48', '#F43F5E', '/api/banks/METRNG/inbound'),
    ('bank-d', 'NOVANG', 'Nova Bank', '044', 'ONLINE', '#7C3AED', '#8B5CF6', '/api/banks/NOVANG/inbound'),
    ('bank-e', 'PARANG', 'Parallel Bank', '055', 'ONLINE', '#D97706', '#F59E0B', '/api/banks/PARANG/inbound')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, institution_id, full_name, email, phone)
VALUES
    ('cust-a1', 'bank-a', 'Fred Okon', 'fred.okon@naijabank.sim', '+234 802 100 0001'),
    ('cust-a2', 'bank-a', 'Zainab Ahmed', 'zainab.ahmed@naijabank.sim', '+234 802 100 0002'),
    ('cust-b1', 'bank-b', 'Chukwuma Obi', 'c.obi@unitybank.sim', '+234 803 200 0001'),
    ('cust-c1', 'bank-c', 'Adaeze Okafor', 'adaeze.o@metrobank.sim', '+234 805 300 0001'),
    ('cust-d1', 'bank-d', 'David Adeleke', 'david.a@novabank.sim', '+234 807 400 0001'),
    ('cust-e1', 'bank-e', 'Tunde Bakare', 'tunde.b@parallelbank.sim', '+234 809 500 0001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.accounts (id, institution_id, customer_id, account_number, account_name, account_type, available_balance, ledger_balance, currency)
VALUES
    ('acct-a1', 'bank-a', 'cust-a1', '0112345678', 'Fred Okon - Savings', 'SAVINGS', 2450000.00, 2450000.00, 'NGN'),
    ('acct-a2', 'bank-a', 'cust-a2', '0119876543', 'Zainab Ahmed - Current', 'CURRENT', 500000.00, 500000.00, 'NGN'),
    ('acct-b1', 'bank-b', 'cust-b1', '0221122334', 'Chukwuma Obi - Current', 'CURRENT', 1200000.00, 1200000.00, 'NGN'),
    ('acct-c1', 'bank-c', 'cust-c1', '0334455667', 'Adaeze Okafor - Savings', 'SAVINGS', 850000.00, 850000.00, 'NGN'),
    ('acct-d1', 'bank-d', 'cust-d1', '0441234567', 'David Adeleke - Premium', 'CURRENT', 3700000.00, 3700000.00, 'NGN'),
    ('acct-e1', 'bank-e', 'cust-e1', '0553344556', 'Tunde Bakare - Corporate', 'CORPORATE', 5000000.00, 5000000.00, 'NGN')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ledger_accounts (id, institution_id, code, name, type, balance, currency)
VALUES
    ('ldg-a-dep', 'bank-a', '1010-CUST-DEP', 'Customer Deposits (Liabilities)', 'LIABILITY', 2950000.00, 'NGN'),
    ('ldg-a-clr', 'bank-a', '1020-SETTLE-CLR', 'Central Bank Settlement Clearing', 'ASSET', 50000000.00, 'NGN'),
    ('ldg-c-dep', 'bank-c', '1010-CUST-DEP', 'Customer Deposits (Liabilities)', 'LIABILITY', 850000.00, 'NGN'),
    ('ldg-c-clr', 'bank-c', '1020-SETTLE-CLR', 'Central Bank Settlement Clearing', 'ASSET', 50000000.00, 'NGN')
ON CONFLICT (id) DO NOTHING;

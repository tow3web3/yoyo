import pool from './connection.js';

// Fresh schema for the Robinhood Chain version. Addresses are 42 chars, tx
// hashes 66, and every token amount is NUMERIC(78,0): 18-decimal Stock Tokens
// overflow BIGINT.
async function migrate() {
  console.log('Running migrations');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_configs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        dev_wallet_encrypted TEXT NOT NULL,
        dev_wallet_public VARCHAR(42) NOT NULL,
        source_token_address VARCHAR(42) NOT NULL,
        target_token_address VARCHAR(42) NOT NULL,
        fee_source VARCHAR(16) NOT NULL DEFAULT 'wallet',
        univ3_position_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        reward_mode VARCHAR(16) NOT NULL DEFAULT 'fixed',
        basket VARCHAR(32),
        portfolio_cursor INTEGER NOT NULL DEFAULT 0,
        destination VARCHAR(16) NOT NULL DEFAULT 'holders',
        schedule_kind VARCHAR(16) NOT NULL DEFAULT 'interval',
        interval_minutes INTEGER NOT NULL DEFAULT 5,
        market_hours_only BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        slippage_bps INTEGER DEFAULT 150,
        min_holder_amount NUMERIC(78,0) DEFAULT 0,
        gas_reserve_wei NUMERIC(78,0) DEFAULT 2000000000000000,
        index_start_block BIGINT,
        vote_cycle_hours INTEGER DEFAULT 24,
        vote_safety_mode VARCHAR(16) DEFAULT 'standard',
        last_execution TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS execution_logs (
        id SERIAL PRIMARY KEY,
        config_id INTEGER REFERENCES bot_configs(id) ON DELETE CASCADE,
        claimed_eth_wei NUMERIC(78,0),
        bought_token_amount NUMERIC(78,0),
        holder_count INTEGER,
        total_airdropped NUMERIC(78,0),
        status VARCHAR(50),
        error_message TEXT,
        reward_token_used VARCHAR(42),
        reward_mode_used VARCHAR(16),
        destination VARCHAR(16),
        swap_tx VARCHAR(66),
        claim_tx VARCHAR(66),
        execution_time TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS airdrop_transactions (
        id SERIAL PRIMARY KEY,
        execution_log_id INTEGER REFERENCES execution_logs(id) ON DELETE CASCADE,
        holder_address VARCHAR(42) NOT NULL,
        holder_balance NUMERIC(78,0),
        airdrop_amount NUMERIC(78,0),
        tx_hash VARCHAR(66),
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Holder ledger built from Transfer logs (see services/holders.js).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS holder_index_state (
        token VARCHAR(42) PRIMARY KEY,
        start_block BIGINT NOT NULL,
        last_block BIGINT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS holder_balances (
        token VARCHAR(42) NOT NULL,
        address VARCHAR(42) NOT NULL,
        balance NUMERIC(78,0) NOT NULL DEFAULT 0,
        PRIMARY KEY (token, address)
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS address_kinds (
        address VARCHAR(42) PRIMARY KEY,
        is_contract BOOLEAN NOT NULL
      );
    `);

    // Loyalty-weighted dividends: the ledger remembers when a wallet started
    // holding and when it last sold, so weight can ramp with holding time.
    await pool.query(`ALTER TABLE holder_balances ADD COLUMN IF NOT EXISTS since_block BIGINT;`);
    await pool.query(`ALTER TABLE holder_balances ADD COLUMN IF NOT EXISTS last_out_block BIGINT;`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN NOT NULL DEFAULT false;`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS loyalty_min_hold_hours INTEGER NOT NULL DEFAULT 0;`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS loyalty_ramp_days INTEGER NOT NULL DEFAULT 30;`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS loyalty_max_bps INTEGER NOT NULL DEFAULT 20000;`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS loyalty_sell_reset BOOLEAN NOT NULL DEFAULT true;`);
    // Receipts: the Telegram group (and topic) where each dividend gets announced.
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS announce_chat_id BIGINT;`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS announce_thread_id INTEGER;`);
    // Fee split: each cycle's ETH goes to holders, buyback-and-burn of the project token, and a stock treasury.
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS split_holders_bps INTEGER NOT NULL DEFAULT 10000;`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS split_burn_bps INTEGER NOT NULL DEFAULT 0;`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS split_treasury_bps INTEGER NOT NULL DEFAULT 0;`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS treasury_address VARCHAR(42);`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS treasury_asset VARCHAR(42);`);
    // Dividend policy: payout ratio (creator share + payout address) and in-kind vs convert.
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS split_creator_bps INTEGER NOT NULL DEFAULT 0;`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS creator_address VARCHAR(42);`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS payout_mode VARCHAR(16) NOT NULL DEFAULT 'in_kind';`);
    await pool.query(`ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS cycle_key VARCHAR(40);`);
    await pool.query(`ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS asset_token VARCHAR(42);`);
    await pool.query(`ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS asset_amount NUMERIC(78,0);`);
    await pool.query(`ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS creator_amount NUMERIC(78,0);`);
    await pool.query(`ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS creator_tx VARCHAR(66);`);
    // Web app accounts: a user may exist with a wallet only (no Telegram yet).
    await pool.query(`ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42) UNIQUE;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS link_code VARCHAR(16);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_nonces (
        nonce VARCHAR(64) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS burn_amount NUMERIC(78,0);`);
    await pool.query(`ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS burn_tx VARCHAR(66);`);
    await pool.query(`ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS treasury_amount NUMERIC(78,0);`);
    await pool.query(`ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS treasury_token VARCHAR(42);`);
    await pool.query(`ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS treasury_tx VARCHAR(66);`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS treasury_ledger (
        id SERIAL PRIMARY KEY,
        config_id INTEGER REFERENCES bot_configs(id) ON DELETE CASCADE,
        token VARCHAR(42) NOT NULL,
        amount NUMERIC(78,0) NOT NULL,
        eth_spent NUMERIC(78,0) NOT NULL DEFAULT 0,
        tx_hash VARCHAR(66),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_treasury_ledger_config ON treasury_ledger(config_id);`);

    // Launchpad hook: registered launchpads, their launch links (deep links that
    // prefill the Telegram setup) and the webhooks that receive dividend events.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS launchpads (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(32) UNIQUE NOT NULL,
        name TEXT NOT NULL,
        website TEXT,
        api_key_hash VARCHAR(64) NOT NULL,
        webhook_url TEXT,
        webhook_secret VARCHAR(64),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS launch_links (
        code VARCHAR(16) PRIMARY KEY,
        launchpad_id INTEGER REFERENCES launchpads(id) ON DELETE SET NULL,
        token VARCHAR(42) NOT NULL,
        creator_wallet VARCHAR(42),
        fee_source VARCHAR(16),
        suggested_reward VARCHAR(42),
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        config_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        linked_at TIMESTAMP
      );
    `);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS launchpad_id INTEGER;`);
    await pool.query(`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS launch_code VARCHAR(16);`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id SERIAL PRIMARY KEY,
        launchpad_id INTEGER REFERENCES launchpads(id) ON DELETE CASCADE,
        event VARCHAR(32) NOT NULL,
        status_code INTEGER,
        ok BOOLEAN,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bot_configs_user_id ON bot_configs(user_id);
      CREATE INDEX IF NOT EXISTS idx_bot_configs_is_active ON bot_configs(is_active);
      CREATE INDEX IF NOT EXISTS idx_bot_configs_source ON bot_configs(source_token_address);
      CREATE INDEX IF NOT EXISTS idx_execution_logs_config_id ON execution_logs(config_id);
      CREATE INDEX IF NOT EXISTS idx_airdrop_transactions_log_id ON airdrop_transactions(execution_log_id);
      CREATE INDEX IF NOT EXISTS idx_holder_balances_token_balance ON holder_balances(token, balance DESC);
    `);

    // Community Vote: holders vote on the next reward token.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vote_cycles (
        id SERIAL PRIMARY KEY,
        config_id INTEGER REFERENCES bot_configs(id) ON DELETE CASCADE,
        status VARCHAR(16) DEFAULT 'open',
        starts_at TIMESTAMP DEFAULT NOW(),
        ends_at TIMESTAMP NOT NULL,
        winning_token VARCHAR(42),
        total_weight NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vote_snapshots (
        cycle_id INTEGER REFERENCES vote_cycles(id) ON DELETE CASCADE,
        holder_address VARCHAR(42) NOT NULL,
        weight NUMERIC NOT NULL,
        PRIMARY KEY (cycle_id, holder_address)
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vote_options (
        id SERIAL PRIMARY KEY,
        cycle_id INTEGER REFERENCES vote_cycles(id) ON DELETE CASCADE,
        token_address VARCHAR(42) NOT NULL,
        proposed_by VARCHAR(42),
        passed_filters BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (cycle_id, token_address)
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS votes (
        cycle_id INTEGER REFERENCES vote_cycles(id) ON DELETE CASCADE,
        voter_address VARCHAR(42) NOT NULL,
        option_id INTEGER REFERENCES vote_options(id) ON DELETE CASCADE,
        weight NUMERIC NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (cycle_id, voter_address)
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vote_cycles_config ON vote_cycles(config_id, status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_votes_option ON votes(option_id);`);

    // Missions: holders of $BOOMERANG complete actions, earn XP, claim rewards.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS missions (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(64) UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        type VARCHAR(32) NOT NULL,
        params JSONB DEFAULT '{}'::jsonb,
        reward_token VARCHAR(42) NOT NULL,
        reward_amount NUMERIC(78,0) NOT NULL,
        total_budget NUMERIC(78,0) NOT NULL DEFAULT 0,
        spent NUMERIC(78,0) NOT NULL DEFAULT 0,
        per_wallet_limit INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mission_completions (
        id SERIAL PRIMARY KEY,
        mission_id INTEGER REFERENCES missions(id) ON DELETE CASCADE,
        wallet VARCHAR(42) NOT NULL,
        status VARCHAR(16) DEFAULT 'verified',
        reward_token VARCHAR(42) NOT NULL,
        reward_amount NUMERIC(78,0) NOT NULL,
        payout_tx VARCHAR(66),
        created_at TIMESTAMP DEFAULT NOW(),
        paid_at TIMESTAMP,
        UNIQUE (mission_id, wallet)
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mission_completions_wallet ON mission_completions(wallet, status);`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mission_users (
        wallet VARCHAR(42) PRIMARY KEY,
        first_seen TIMESTAMP DEFAULT NOW(),
        last_seen TIMESTAMP DEFAULT NOW()
      );
    `);

    // Starter missions, rewards in ETH (wei).
    const ETH = '0x0000000000000000000000000000000000000000';
    const seed = [
      ['holder-100k', 'Holder', 'Hold at least 100,000 $BOOMERANG.', 'hold', { minAmount: 100000 }, 50, '100000000000000', '20000000000000000'],
      ['diamond-500k', 'Diamond hands', 'Hold at least 500,000 $BOOMERANG.', 'hold', { minAmount: 500000 }, 100, '300000000000000', '30000000000000000'],
      ['whale-1m', 'Whale', 'Hold at least 1,000,000 $BOOMERANG.', 'hold', { minAmount: 1000000 }, 200, '1000000000000000', '50000000000000000'],
      ['first-vote', 'Cast your first vote', 'Vote in any Community Vote cycle.', 'vote', {}, 75, '200000000000000', '20000000000000000'],
      ['active-voter', 'Active voter', 'Vote in 3 different Community Vote cycles.', 'vote_count', { count: 3 }, 150, '500000000000000', '20000000000000000'],
      ['link-token', 'Become a customer', 'Link one of your tokens to Boomerang.', 'customer', {}, 200, '1000000000000000', '50000000000000000'],
      ['roulette-on', 'Spin the wheel', 'Enable Stock Roulette on one of your tokens.', 'roulette_mode', {}, 120, '500000000000000', '20000000000000000'],
      ['vote-on', 'Power to the people', 'Enable Community Vote on one of your tokens.', 'vote_mode', {}, 120, '500000000000000', '20000000000000000'],
    ];
    for (const [slug, title, description, type, params, xp, reward, budget] of seed) {
      await pool.query(
        `INSERT INTO missions (slug, title, description, type, params, xp, reward_token, reward_amount, total_budget)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (slug) DO NOTHING`,
        [slug, title, description, type, JSON.stringify(params), xp, ETH, reward, budget]
      );
    }

    console.log('Migration complete');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
// Immutable data structures and validation for NEAR HTLC Escrow
use near_sdk::json_types::U128;
use near_sdk::{
    env, near, require,
    serde::{Deserialize, Serialize},
    AccountId,
};

/// Immutable escrow parameters - set once during creation
#[near(serializers = [json,borsh])]
pub struct EscrowImmutables {
    pub order_hash: String,        // 32-byte hex string
    pub hashlock: String,          // 32-byte hex string
    pub maker: AccountId,          // NEAR account
    pub taker_evm_address: String, // EVM address as hex string
    pub amount: U128,              // NEAR amount in yoctoNEAR
    pub safety_deposit: U128,      // Safety deposit amount
}

impl EscrowImmutables {
    /// Create new immutable escrow parameters with validation
    pub fn new(
        order_hash: String,
        hashlock: String,
        maker: AccountId,
        taker_evm_address: String,
        amount: U128,
        safety_deposit: U128,
    ) -> Self {
        // Validate order hash format
        Self::validate_order_hash(&order_hash);

        // Validate hashlock format
        Self::validate_hashlock(&hashlock);

        // Validate EVM address format
        Self::validate_evm_address(&taker_evm_address);

        // Validate amounts
        require!(amount.0 > 0, "Amount must be greater than 0");
        require!(safety_deposit.0 >= 0, "Safety deposit must be non-negative");

        Self {
            order_hash,
            hashlock,
            maker,
            taker_evm_address,
            amount,
            safety_deposit,
        }
    }

    /// Validate order hash format (32-byte hex string)
    fn validate_order_hash(order_hash: &str) {
        require!(!order_hash.is_empty(), "Order hash cannot be empty");

        let cleaned_hash = if order_hash.starts_with("0x") {
            &order_hash[2..]
        } else {
            order_hash
        };

        require!(
            cleaned_hash.len() == 64,
            "Order hash must be 32 bytes (64 hex characters)"
        );

        require!(
            cleaned_hash.chars().all(|c| c.is_ascii_hexdigit()),
            "Order hash must contain only hex characters"
        );
    }

    /// Validate hashlock format (32-byte hex string)
    fn validate_hashlock(hashlock: &str) {
        require!(!hashlock.is_empty(), "Hashlock cannot be empty");

        let cleaned_hash = if hashlock.starts_with("0x") {
            &hashlock[2..]
        } else {
            hashlock
        };

        require!(
            cleaned_hash.len() == 64,
            "Hashlock must be 32 bytes (64 hex characters)"
        );

        require!(
            cleaned_hash.chars().all(|c| c.is_ascii_hexdigit()),
            "Hashlock must contain only hex characters"
        );
    }

    /// Validate EVM address format (20-byte hex string)
    fn validate_evm_address(address: &str) {
        require!(!address.is_empty(), "EVM address cannot be empty");

        let cleaned_address = if address.starts_with("0x") {
            &address[2..]
        } else {
            address
        };

        require!(
            cleaned_address.len() == 40,
            "EVM address must be 20 bytes (40 hex characters)"
        );

        require!(
            cleaned_address.chars().all(|c| c.is_ascii_hexdigit()),
            "EVM address must contain only hex characters"
        );
    }

    /// Get total required deposit (amount + safety deposit)
    pub fn get_total_required(&self) -> u128 {
        self.amount.0 + self.safety_deposit.0
    }

    /// Verify secret against hashlock
    pub fn verify_secret(&self, secret: &str) -> bool {
        let secret_hash = Self::compute_sha256(secret);
        let expected_hash = if self.hashlock.starts_with("0x") {
            self.hashlock.clone()
        } else {
            format!("0x{}", self.hashlock)
        };

        secret_hash.to_lowercase() == expected_hash.to_lowercase()
    }

    /// Compute SHA256 hash of input string
    pub fn compute_sha256(input: &str) -> String {
        let hash = env::sha256(input.as_bytes());
        format!("0x{}", hex::encode(hash))
    }

    /// Get normalized hashlock (with 0x prefix)
    pub fn get_normalized_hashlock(&self) -> String {
        if self.hashlock.starts_with("0x") {
            self.hashlock.clone()
        } else {
            format!("0x{}", self.hashlock)
        }
    }

    /// Get normalized order hash (with 0x prefix)
    pub fn get_normalized_order_hash(&self) -> String {
        if self.order_hash.starts_with("0x") {
            self.order_hash.clone()
        } else {
            format!("0x{}", self.order_hash)
        }
    }

    /// Get normalized EVM address (with 0x prefix)
    pub fn get_normalized_evm_address(&self) -> String {
        if self.taker_evm_address.starts_with("0x") {
            self.taker_evm_address.clone()
        } else {
            format!("0x{}", self.taker_evm_address)
        }
    }
}

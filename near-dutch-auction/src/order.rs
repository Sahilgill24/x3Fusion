use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::require;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, PanicOnDefault};

/// Order
#[near(serializers = [json,Borsh])]
pub struct Order {
    pub salt: u64,
    pub maker: AccountId,
    pub maker_asset: String,
    pub making_amount: U128,
}


impl Order {
    /// Generate a hash for an order
    pub fn hash_order(&self) -> String {
        // Combine order fields into a single string for hashing
        let order_data = format!(
            "{}:{}:{}:{}",
            self.salt, self.maker, self.maker_asset, self.making_amount.0
        );

        // Create hash using
        let hash_bytes = env::keccak256(order_data.as_bytes());

        let mut hex_hash = String::with_capacity(hash_bytes.len() * 2);
        for byte in hash_bytes.iter() {
            hex_hash.push_str(&format!("{:02x}", byte));
        }

        hex_hash
    }
}

// I have followed the same implementation as the DutchAuctionCalculator in the Limit-Order-Protocol.
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
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

/// Response with price and order information
#[near(serializers = [json,Borsh])]

pub struct PriceInfo {
    /// Current price based on time decay
    pub current_price: U128,
    /// Hash of the order for tracking
    pub order_hash: String,
    /// Percentage of auction time elapsed (0-100)
    pub time_elapsed_percent: u8,
    /// Whether the auction is still active
    pub is_active: bool,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct DutchAuctionCalculator {}

#[near]
impl DutchAuctionCalculator {
    #[init]
    pub fn new() -> Self {
        Self {}
    }

    pub fn calc_price(
        &self,
        start_time: u64,
        end_time: u64,
        start_price: U128,
        end_price: U128,
    ) -> U128 {
        let current_time = env::block_timestamp() / 1_000_000; // in ms

        // clamp now between start_time and end_time
        let now_clamped = std::cmp::max(
            start_time as u128,
            std::cmp::min(end_time as u128, current_time as u128),
        );

        if now_clamped <= start_time as u128 {
            return start_price;
        }
        if now_clamped >= end_time as u128 {
            return end_price;
        }

        let span = end_time as u128 - start_time as u128;
        let start_price_u128: u128 = start_price.into();
        let end_price_u128: u128 = end_price.into();

        // Linear interpolation:
        // same logic as the EVM implementation in the Limit Order protocol.
        // price = (start_price * (end_time - now) + end_price * (now - start_time)) / span
        let price = (start_price_u128 * (end_time as u128 - now_clamped)
            + end_price_u128 * (now_clamped - start_time as u128))
            / span;

        U128(price)
    }

    /// Generate a hash for an order
    pub fn hash_order(&self, order: &Order) -> String {
        // Combine order fields into a single string for hashing
        let order_data = format!(
            "{}:{}:{}:{}",
            order.salt, order.maker, order.maker_asset, order.making_amount.0
        );

        // Create hash using NEAR's built-in hash function
        let hash_bytes = env::sha256(order_data.as_bytes());

        // Convert binary hash to hexadecimal string
        let mut hex_hash = String::with_capacity(hash_bytes.len() * 2);
        for byte in hash_bytes.iter() {
            hex_hash.push_str(&format!("{:02x}", byte));
        }

        hex_hash
    }

    /// Get current price and order information for a Dutch auction order
    pub fn get_price_info(
        &self,
        order: Order,
        start_time: u64,
        end_time: u64,
        start_price: U128,
        end_price: U128,
    ) -> PriceInfo {
        // Calculate current price
        let current_price = self.calc_price(start_time, end_time, start_price, end_price);

        // Generate order hash
        let order_hash = self.hash_order(&order);

        // Calculate time progress percentage
        let current_time = env::block_timestamp() / 1_000_000; // in ms

        // Calculate percentage of time elapsed (0-100)
        let time_elapsed_percent = if end_time <= start_time {
            100 // Avoid division by zero
        } else {
            let elapsed = current_time as u64 - start_time;
            let total = end_time - start_time;
            let percent = (elapsed * 100) / total;
            std::cmp::min(100, percent as u8) // Clamp to 0-100
        };

        // Check if auction is still active
        let is_active = (current_time as u64) < end_time;

        PriceInfo {
            current_price,
            order_hash,
            time_elapsed_percent,
            is_active,
        }
    }
}

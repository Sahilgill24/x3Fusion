

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, log, near, require, AccountId, NearToken, PanicOnDefault};


// I have added the order fill and dutch auction logic together here. 

#[near(serializers=[json,Borsh])]
pub struct Order {
    pub salt: u64,
    pub maker: AccountId,
    pub receiver: AccountId,
    pub maker_asset: String, // "NEAR" for native token, or token contract ID
    pub making_amount: U128,
    pub filled_amount: U128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct DutchAuctionCalculator {
    /// Track filled amounts for each order hash
    pub filled_amounts: UnorderedMap<String, U128>,
}

#[near]
impl DutchAuctionCalculator {
    #[init]
    pub fn new() -> Self {
        Self {
            filled_amounts: UnorderedMap::new(b"f"),
        }
    }

    /// Calculate current price using Dutch auction mechanism
    pub fn calc_price(&self, times: u128, start_price: U128, end_price: U128) -> U128 {
        let start_time = times >> 64;
        let end_time = times & 0xFFFFFFFFFFFFFFFF;
        let current_time = env::block_timestamp() / 1_000_000; // Convert to milliseconds

        let now_clamped = std::cmp::max(start_time, std::cmp::min(end_time, current_time as u128));

        if now_clamped <= start_time {
            return start_price;
        }
        if now_clamped >= end_time {
            return end_price;
        }

        let span = end_time - start_time;
        let start_price_u128: u128 = start_price.into();
        let end_price_u128: u128 = end_price.into();

        // Linear interpolation: start_price * (end_time - now) + end_price * (now - start_time) / span
        let price = (start_price_u128 * (end_time - now_clamped)
            + end_price_u128 * (now_clamped - start_time))
            / span;

        U128(price)
    }

    /// Calculate making amount for an order with partial fill support
    pub fn get_making_amount(
        &self,
        order: Order,
        offchain_amount: U128,
        times: u128,
        start_price: U128,
        end_price: U128,
    ) -> U128 {
        let price = self.calc_price(times, start_price, end_price);
        let price_u128: u128 = price.into();
        let offchain_amount_u128: u128 = offchain_amount.into();
        let making_amount_u128: u128 = order.making_amount.into();
        let filled_amount_u128: u128 = order.filled_amount.into();

        // Calculate available amount (unfilled portion)
        let available_amount = making_amount_u128 - filled_amount_u128;
        let requested_amount = (available_amount * offchain_amount_u128) / price_u128;

        // Return minimum of requested and available
        U128(std::cmp::min(requested_amount, available_amount))
    }

    /// Get remaining fillable amount for an order
    pub fn get_remaining_amount(&self, order: Order) -> U128 {
        U128(order.making_amount.0 - order.filled_amount.0)
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, VMContext};

    fn get_context(predecessor: AccountId) -> VMContext {
        VMContextBuilder::new()
            .predecessor_account_id(predecessor)
            .build()
    }

    #[test]
    fn test_price_calculation() {
        let contract = DutchAuctionCalculator::new();

        // Test with start_time=0, end_time=1000, current_time=500
        let times = 1000u128; // end_time=1000, start_time=0
        let start_price = U128(1000);
        let end_price = U128(500);

        let price = contract.calc_price(times, start_price, end_price);
        // At 50% time elapsed, price should be 750
        assert_eq!(price.0, 750);
    }

    #[test]
    fn test_making_amount_calculation() {
        let contract = DutchAuctionCalculator::new();
        let context = get_context(accounts(0));
        testing_env!(context);

        let order = Order {
            salt: 1,
            maker: accounts(0),
            receiver: accounts(1),
            maker_asset: "NEAR".to_string(),
            making_amount: U128(1000),
            filled_amount: U128(200), // 200 already filled
        };

        let times = 1000u128;
        let start_price = U128(100);
        let end_price = U128(50);

        let making_amount = contract.get_making_amount(order, U128(500), times, start_price, end_price);
        
        // Should return some amount based on current price and available amount (800)
        assert!(making_amount.0 > 0);
        assert!(making_amount.0 <= 800); // Can't exceed available amount
    }
}

// SPDX-License-Identifier: MIT
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::{env, near, PanicOnDefault};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct DutchAuctionCalculator {}

#[near]

impl DutchAuctionCalculator {
    #[init]
    pub fn new() -> Self {
        Self {}
    }

    /// Calculate current price using Dutch auction mechanism.
    ///
    /// `times` is a concatenation of two 64-bit numbers:
    /// high 64 bits = `start_time`, low 64 bits = `end_time` (both in ms).
    /// `start_price` and `end_price` are the initial and final prices.
    pub fn calc_price(&self, times: u128, start_price: U128, end_price: U128) -> U128 {
        let start_time = times >> 64;
        let end_time = times & 0xFFFFFFFFFFFFFFFF;
        let current_time = env::block_timestamp() / 1_000_000; // in ms

        // clamp now between start_time and end_time
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

        // Linear interpolation:
        // price = (start_price * (end_time - now) + end_price * (now - start_time)) / span
        let price = (start_price_u128 * (end_time - now_clamped)
            + end_price_u128 * (now_clamped - start_time))
            / span;

        U128(price)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::{testing_env, VMContext};

    fn get_context() -> VMContext {
        VMContextBuilder::new()
            .block_timestamp(500 * 1_000_000) // 500 ms in nanoseconds
            .build()
    }

    #[test]
    fn test_price_at_start() {
        testing_env!(get_context());
        let contract = DutchAuctionCalculator::new();
        let times = (0u128 << 64) | 1_000u128; // start=0, end=1000 ms
        let start_price = U128(1000);
        let end_price = U128(500);
        assert_eq!(contract.calc_price(times, start_price, end_price).0, 1000);
    }

    #[test]
    fn test_price_midway() {
        testing_env!(get_context());
        let contract = DutchAuctionCalculator::new();
        let times = (0u128 << 64) | 1_000u128; // start=0, end=1000 ms
        let start_price = U128(1000);
        let end_price = U128(500);
        // at t=500, price = 750
        assert_eq!(contract.calc_price(times, start_price, end_price).0, 750);
    }

    #[test]
    fn test_price_at_end() {
        // move context past end
        let mut ctx = get_context();
        ctx.block_timestamp = 1_000 * 1_000_000; // 1000 ms
        testing_env!(ctx);
        let contract = DutchAuctionCalculator::new();
        let times = (0u128 << 64) | 1_000u128;
        let start_price = U128(1000);
        let end_price = U128(500);
        assert_eq!(contract.calc_price(times, start_price, end_price).0, 500);
    }
}

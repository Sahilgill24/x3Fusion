// Timelock management for NEAR HTLC Escrow
use near_sdk::{
    borsh::{BorshDeserialize, BorshSerialize},
    env, near, require,
};
use serde::{Deserialize, Serialize};

/// Timelock stages for escrow lifecycle (matching Ethereum destination chain)
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum TimelockStage {
    Withdrawal,       // Private withdrawal period (only maker with secret)
    PublicWithdrawal, // Public withdrawal period (anyone with secret)
    Cancellation,     // Cancellation period (anyone can cancel)
}

/// Timelock configuration and utilities (destination chain pattern)
#[near(serializers = [json,borsh])]
pub struct Timelocks {
    pub withdrawal_timelock: u64, // Timestamp when private withdrawal is allowed
    pub public_withdrawal_timelock: u64, // Timestamp when public withdrawal is allowed
    pub cancellation_timelock: u64, // Timestamp when cancellation is allowed
    pub created_at: u64,          // Contract creation timestamp
}

impl Timelocks {
    /// Create new timelocks with validation (destination chain pattern)
    pub fn new(
        withdrawal_timelock: u64,
        public_withdrawal_timelock: u64,
        cancellation_timelock: u64,
    ) -> Self {
        let current_time = Self::get_current_timestamp();

        // Validate timelock sequence
        Self::validate_timelock_sequence(
            current_time,
            withdrawal_timelock,
            public_withdrawal_timelock,
            cancellation_timelock,
        );

        Self {
            withdrawal_timelock,
            public_withdrawal_timelock,
            cancellation_timelock,
            created_at: current_time,
        }
    }

    /// Validate timelock sequence and timing for destination chain
    fn validate_timelock_sequence(
        current_time: u64,
        withdrawal_timelock: u64,
        public_withdrawal_timelock: u64,
        cancellation_timelock: u64,
    ) {
        require!(
            withdrawal_timelock > current_time,
            "Withdrawal timelock must be in the future"
        );

        require!(
            public_withdrawal_timelock > withdrawal_timelock,
            "Public withdrawal timelock must be after withdrawal timelock"
        );

        require!(
            cancellation_timelock > public_withdrawal_timelock,
            "Cancellation timelock must be after public withdrawal timelock"
        );

        // Ensure reasonable timelock periods for destination chain
        let min_withdrawal_delay = 1800; // 30 minutes minimum
        let max_timelock_period = 86400 * 7; // 7 days maximum for destination

        require!(
            withdrawal_timelock >= current_time + min_withdrawal_delay,
            "Withdrawal timelock must be at least 30 minutes in the future"
        );

        require!(
            cancellation_timelock <= current_time + max_timelock_period,
            "Cancellation timelock cannot be more than 7 days in the future"
        );
    }

    /// Check if withdrawal is allowed at current time (private period)
    pub fn can_withdraw(&self) -> bool {
        let current_time = Self::get_current_timestamp();
        current_time >= self.withdrawal_timelock
    }

    /// Check if public withdrawal is allowed at current time
    pub fn can_public_withdraw(&self) -> bool {
        let current_time = Self::get_current_timestamp();
        current_time >= self.public_withdrawal_timelock
    }

    /// Check if cancellation is allowed at current time
    pub fn can_cancel(&self) -> bool {
        let current_time = Self::get_current_timestamp();
        current_time >= self.cancellation_timelock
    }

    /// Check if emergency refund is allowed (24 hours after cancellation)
    pub fn can_emergency_refund(&self) -> bool {
        let current_time = Self::get_current_timestamp();
        let emergency_timelock = self.cancellation_timelock + 86400; // +24 hours
        current_time >= emergency_timelock
    }

    /// Get current timestamp in seconds
    pub fn get_current_timestamp() -> u64 {
        env::block_timestamp_ms() / 1000
    }

    /// Get time remaining until withdrawal is allowed
    pub fn time_until_withdrawal(&self) -> Option<u64> {
        let current_time = Self::get_current_timestamp();
        if current_time >= self.withdrawal_timelock {
            None
        } else {
            Some(self.withdrawal_timelock - current_time)
        }
    }

    /// Get time remaining until public withdrawal is allowed
    pub fn time_until_public_withdrawal(&self) -> Option<u64> {
        let current_time = Self::get_current_timestamp();
        if current_time >= self.public_withdrawal_timelock {
            None
        } else {
            Some(self.public_withdrawal_timelock - current_time)
        }
    }

    /// Get time remaining until cancellation is allowed
    pub fn time_until_cancellation(&self) -> Option<u64> {
        let current_time = Self::get_current_timestamp();
        if current_time >= self.cancellation_timelock {
            None
        } else {
            Some(self.cancellation_timelock - current_time)
        }
    }

    /// Get time remaining until emergency refund is allowed
    pub fn time_until_emergency(&self) -> Option<u64> {
        let current_time = Self::get_current_timestamp();
        let emergency_timelock = self.cancellation_timelock + 86400;
        if current_time >= emergency_timelock {
            None
        } else {
            Some(emergency_timelock - current_time)
        }
    }

    /// Check timelock for specific stage
    pub fn check_timelock(&self, stage: TimelockStage) -> Result<(), &'static str> {
        match stage {
            TimelockStage::Withdrawal => {
                if self.can_withdraw() {
                    Ok(())
                } else {
                    Err("Withdrawal timelock not met")
                }
            }
            TimelockStage::PublicWithdrawal => {
                if self.can_public_withdraw() {
                    Ok(())
                } else {
                    Err("Public withdrawal timelock not met")
                }
            }
            TimelockStage::Cancellation => {
                if self.can_cancel() {
                    Ok(())
                } else {
                    Err("Cancellation timelock not met")
                }
            }
        }
    }

    /// Require timelock condition for specific stage
    pub fn require_timelock(&self, stage: TimelockStage) {
        match self.check_timelock(stage) {
            Ok(()) => {}
            Err(msg) => require!(false, msg),
        }
    }

    /// Get human-readable status of timelocks
    pub fn get_status(&self) -> String {
        let current_time = Self::get_current_timestamp();

        if current_time < self.withdrawal_timelock {
            format!(
                "Waiting for withdrawal timelock ({}s remaining)",
                self.withdrawal_timelock - current_time
            )
        } else if current_time < self.public_withdrawal_timelock {
            "Private withdrawal period active".to_string()
        } else if current_time < self.cancellation_timelock {
            "Public withdrawal period active".to_string()
        } else {
            "Cancellation period active".to_string()
        }
    }

    /// Create timelocks with relative delays from current time (destination chain pattern)
    pub fn create_with_delays(
        withdrawal_delay_seconds: u64,
        public_withdrawal_delay_seconds: u64,
        cancellation_delay_seconds: u64,
    ) -> Self {
        let current_time = Self::get_current_timestamp();
        Self::new(
            current_time + withdrawal_delay_seconds,
            current_time + public_withdrawal_delay_seconds,
            current_time + cancellation_delay_seconds,
        )
    }

    /// Create timelocks optimized for NEAR as destination chain in EVM->NEAR swaps
    pub fn create_destination_chain() -> Self {
        Self::create_with_delays(18, 54, 144) // 30 min, 1.5 hours, 4 hours
    }

    pub fn create_standard() -> Self {
        Self::create_with_delays(36, 72, 864) // 1 hour, 2 hours, 24 hours
    }
}

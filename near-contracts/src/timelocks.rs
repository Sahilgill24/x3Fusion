// Timelock management for NEAR HTLC Escrow
use near_sdk::{
    borsh::{BorshDeserialize, BorshSerialize},
    env, near, require,
};
use serde::{Deserialize, Serialize};

/// Timelock stages for escrow lifecycle
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum TimelockStage {
    Withdrawal,
    Cancellation,
    Emergency,
}

/// Timelock configuration and utilities
#[near(serializers = [json,borsh])]
pub struct Timelocks {
    pub withdrawal_timelock: u64,   // Timestamp when withdrawal is allowed
    pub cancellation_timelock: u64, // Timestamp when cancellation is allowed
    pub created_at: u64,            // Contract creation timestamp
}

impl Timelocks {
    /// Create new timelocks with validation
    pub fn new(withdrawal_timelock: u64, cancellation_timelock: u64) -> Self {
        let current_time = Self::get_current_timestamp();

        // Validate timelock sequence
        Self::validate_timelock_sequence(current_time, withdrawal_timelock, cancellation_timelock);

        Self {
            withdrawal_timelock,
            cancellation_timelock,
            created_at: current_time,
        }
    }

    /// Validate timelock sequence and timing
    fn validate_timelock_sequence(
        current_time: u64,
        withdrawal_timelock: u64,
        cancellation_timelock: u64,
    ) {
        require!(
            withdrawal_timelock > current_time,
            "Withdrawal timelock must be in the future"
        );

        require!(
            cancellation_timelock > withdrawal_timelock,
            "Cancellation timelock must be after withdrawal timelock"
        );

        // Ensure reasonable timelock periods
        let min_withdrawal_delay = 3600; // 1 hour minimum
        let max_timelock_period = 86400 * 30; // 30 days maximum

        require!(
            withdrawal_timelock >= current_time + min_withdrawal_delay,
            "Withdrawal timelock must be at least 1 hour in the future"
        );

        require!(
            cancellation_timelock <= current_time + max_timelock_period,
            "Cancellation timelock cannot be more than 30 days in the future"
        );
    }

    /// Check if withdrawal is allowed at current time
    pub fn can_withdraw(&self) -> bool {
        let current_time = Self::get_current_timestamp();
        current_time >= self.withdrawal_timelock
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
            TimelockStage::Cancellation => {
                if self.can_cancel() {
                    Ok(())
                } else {
                    Err("Cancellation timelock not met")
                }
            }
            TimelockStage::Emergency => {
                if self.can_emergency_refund() {
                    Ok(())
                } else {
                    Err("Emergency timelock not met")
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
        } else if current_time < self.cancellation_timelock {
            "Withdrawal period active".to_string()
        } else {
            "Cancellation period active".to_string()
        }
    }

    /// Create timelocks with relative delays from current time
    pub fn create_with_delays(
        withdrawal_delay_seconds: u64,
        cancellation_delay_seconds: u64,
    ) -> Self {
        let current_time = Self::get_current_timestamp();
        Self::new(
            current_time + withdrawal_delay_seconds,
            current_time + cancellation_delay_seconds,
        )
    }


    pub fn create_standard() -> Self {
        Self::create_with_delays(3600, 86400) // 1 hour, 24 hours
    }


}

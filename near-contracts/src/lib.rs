use near_sdk::borsh::{self, BorshDeserialize};
// NEAR Protocol HTLC Escrow for Fusion+ Cross-Chain Extension
// Factory contract will be used to deploy this
use near_sdk::json_types::U128;
use near_sdk::{
    env, log, near, require,
    serde::{Deserialize, Serialize},
    AccountId, NearToken, Promise,
};

mod immutables;
mod timelocks;

pub use immutables::EscrowImmutables;
pub use timelocks::{TimelockStage, Timelocks};

#[derive(Serialize, Deserialize)]
#[near(contract_state)]
pub struct HTLCEscrow {
    // Immutable parameters
    pub immutables: EscrowImmutables,

    // Timelock configuration
    pub timelocks: Timelocks,

    // Mutable state
    pub deposited_amount: U128,
    pub depositor: AccountId,
    pub is_withdrawn: bool,
    pub is_cancelled: bool,
    pub revealed_secret: Option<String>,
}

impl Default for HTLCEscrow {
    fn default() -> Self {
        panic!("hello gentlemen")
    }
}
#[near]
impl HTLCEscrow {
    #[init]
    #[payable]
    pub fn new(
        order_hash: String,
        hashlock: String,
        maker: AccountId,
        taker_evm_address: String,
        amount: U128,
        safety_deposit: U128,
        withdrawal_timelock: u64,
        cancellation_timelock: u64,
    ) -> Self {
        let deposited = env::attached_deposit().as_near();

        // Create and validate immutables
        let immutables = EscrowImmutables::new(
            order_hash.clone(),
            hashlock,
            maker.clone(),
            taker_evm_address,
            amount,
            safety_deposit,
        );

        // Validate deposit amount
        let required_amount = immutables.get_total_required();
        require!(deposited >= required_amount, "Insufficient deposit");

        // Create and validate timelocks
        let timelocks = Timelocks::new(withdrawal_timelock, cancellation_timelock);

        log!(
            "HTLC Escrow created: order_hash={}, amount={}, maker={}",
            order_hash,
            deposited,
            maker
        );

        Self {
            immutables,
            timelocks,
            deposited_amount: U128(deposited),
            depositor: env::predecessor_account_id(),
            is_withdrawn: false,
            is_cancelled: false,
            revealed_secret: None,
        }
    }

    /// Withdraw funds by revealing the secret (equivalent to withdraw in Solidity)
    /// No order_hash needed - this contract IS the escrow
    pub fn withdraw(&mut self, secret: String) -> Promise {
        require!(!self.is_withdrawn, "Already withdrawn");
        require!(!self.is_cancelled, "Escrow cancelled");

        // Verify secret matches hashlock using immutables
        require!(self.immutables.verify_secret(&secret), "Invalid secret");

        // Check timelock using timelocks module
        self.timelocks.require_timelock(TimelockStage::Withdrawal);

        // Update state
        self.is_withdrawn = true;
        self.revealed_secret = Some(secret.clone());

        log!(
            "HTLC Withdrawal: order_hash={}, secret={}, taker_evm={}",
            self.immutables.order_hash,
            secret,
            self.immutables.taker_evm_address
        );

        // Transfer funds to maker
        Promise::new(self.immutables.maker.clone())
            .transfer(NearToken::from_near(self.immutables.amount.0))
    }

    /// Cancel escrow and return funds (equivalent to cancel in Solidity)
    /// No order_hash needed - this contract IS the escrow
    pub fn cancel(&mut self) -> Promise {
        require!(!self.is_withdrawn, "Already withdrawn");
        require!(!self.is_cancelled, "Already cancelled");

        // Check cancellation timelock using timelocks module
        self.timelocks.require_timelock(TimelockStage::Cancellation);

        // Update state
        self.is_cancelled = true;

        log!(
            "HTLC Cancelled: order_hash={}, refunded_to={}",
            self.immutables.order_hash,
            self.depositor
        );

        // Refund to depositor
        Promise::new(self.depositor.clone()).transfer(NearToken::from_near(self.deposited_amount.0))
    }

    /// View functions - like Solidity public variables
    pub fn get_order_hash(&self) -> String {
        self.immutables.order_hash.clone()
    }

    pub fn get_hashlock(&self) -> String {
        self.immutables.hashlock.clone()
    }

    pub fn get_maker(&self) -> AccountId {
        self.immutables.maker.clone()
    }

    pub fn get_taker_evm_address(&self) -> String {
        self.immutables.taker_evm_address.clone()
    }

    pub fn get_amount(&self) -> U128 {
        self.immutables.amount
    }

    pub fn get_safety_deposit(&self) -> U128 {
        self.immutables.safety_deposit
    }

    pub fn get_withdrawal_timelock(&self) -> u64 {
        self.timelocks.withdrawal_timelock
    }

    pub fn get_cancellation_timelock(&self) -> u64 {
        self.timelocks.cancellation_timelock
    }

    pub fn get_deposited_amount(&self) -> U128 {
        self.deposited_amount
    }

    pub fn get_depositor(&self) -> AccountId {
        self.depositor.clone()
    }

    pub fn is_withdrawn(&self) -> bool {
        self.is_withdrawn
    }

    pub fn is_cancelled(&self) -> bool {
        self.is_cancelled
    }

    pub fn get_revealed_secret(&self) -> Option<String> {
        self.revealed_secret.clone()
    }

    pub fn get_created_at(&self) -> u64 {
        self.timelocks.created_at
    }

    /// Check if escrow is active (not withdrawn and not cancelled)
    pub fn is_active(&self) -> bool {
        !self.is_withdrawn && !self.is_cancelled
    }

    /// Get current status as string
    pub fn get_status(&self) -> String {
        if self.is_withdrawn {
            "withdrawn".to_string()
        } else if self.is_cancelled {
            "cancelled".to_string()
        } else {
            "active".to_string()
        }
    }

    /// Get timelock status
    pub fn get_timelock_status(&self) -> String {
        self.timelocks.get_status()
    }

    /// Check if withdrawal is currently allowed
    pub fn can_withdraw_now(&self) -> bool {
        self.timelocks.can_withdraw()
    }

    /// Check if cancellation is currently allowed
    pub fn can_cancel_now(&self) -> bool {
        self.timelocks.can_cancel()
    }

    /// Get time remaining until withdrawal
    pub fn time_until_withdrawal(&self) -> Option<u64> {
        self.timelocks.time_until_withdrawal()
    }

    /// Get time remaining until cancellation
    pub fn time_until_cancellation(&self) -> Option<u64> {
        self.timelocks.time_until_cancellation()
    }

    /// Emergency function for depositor to handle stuck funds (with timelock)
    pub fn emergency_refund(&mut self) -> Promise {
        require!(
            env::predecessor_account_id() == self.depositor,
            "Only depositor can emergency refund"
        );

        // Use timelocks module for emergency timelock check
        self.timelocks.require_timelock(TimelockStage::Emergency);

        log!(
            "Emergency refund: order_hash={}",
            self.immutables.order_hash
        );

        Promise::new(self.depositor.clone()).transfer(NearToken::from_near(self.deposited_amount.0))
    }
}

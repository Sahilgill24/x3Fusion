// NEAR Protocol HTLC Escrow for Fusion+ Cross-Chain Extension
// Direct escrow approach - each contract handles one escrow (like EVM)
use near_sdk::json_types::U128;
use near_sdk::{
    env, log, near, require,
    serde::{Deserialize, Serialize},
    AccountId, NearToken, Promise,
};

// Direct state escrow contract - no maps needed, just like EVM
#[near(contract_state)]
pub struct HTLCEscrow {
    // Direct state variables (like Solidity public variables)
    pub order_hash: String,         // 32-byte hex string
    pub hashlock: String,           // 32-byte hex string
    pub maker: AccountId,           // NEAR account
    pub taker_evm_address: String,  // EVM address as hex string
    pub amount: U128,               // NEAR amount in yoctoNEAR
    pub safety_deposit: U128,       // Safety deposit amount
    pub withdrawal_timelock: u64,   // Timestamp when withdrawal is allowed
    pub cancellation_timelock: u64, // Timestamp when cancellation is allowed
    pub target_chain_id: u8,        // EVM chain ID (1=mainnet, 11155111=sepolia)

    // State tracking (like Solidity state variables)
    pub deposited_amount: U128,
    pub depositor: AccountId,
    pub is_withdrawn: bool,
    pub is_cancelled: bool,
    pub revealed_secret: Option<String>, // Revealed secret (32-byte hex)
    pub created_at: u64,
}

impl Default for HTLCEscrow {
    fn default() -> Self {
        panic!("Contract must be initialized with new() - no default escrow state")
    }
}

#[near]
impl HTLCEscrow {
    /// Initialize this specific escrow contract (called during deployment)
    /// This is like a Solidity constructor - each contract handles one escrow
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
        target_chain_id: u8,
    ) -> Self {
        let deposited = env::attached_deposit().as_near();
        let required_amount = amount.0 + safety_deposit.0;

        require!(deposited >= required_amount, "Insufficient deposit");

        // Validate timelocks
        let current_time = env::block_timestamp_ms() / 1000; // Convert to seconds
        require!(
            withdrawal_timelock > current_time,
            "Invalid withdrawal timelock"
        );
        require!(
            cancellation_timelock > withdrawal_timelock,
            "Invalid cancellation timelock"
        );

        log!(
            "HTLC Escrow created: order_hash={}, amount={}, maker={}",
            order_hash,
            deposited,
            maker
        );

        Self {
            order_hash,
            hashlock,
            maker,
            taker_evm_address,
            amount,
            safety_deposit,
            withdrawal_timelock,
            cancellation_timelock,
            target_chain_id,
            deposited_amount: U128(deposited),
            depositor: env::predecessor_account_id(),
            is_withdrawn: false,
            is_cancelled: false,
            revealed_secret: None,
            created_at: current_time,
        }
    }

    /// Withdraw funds by revealing the secret (equivalent to withdraw in Solidity)
    /// No order_hash needed - this contract IS the escrow
    pub fn withdraw(&mut self, secret: String) -> Promise {
        require!(!self.is_withdrawn, "Already withdrawn");
        require!(!self.is_cancelled, "Escrow cancelled");

        // Verify secret matches hashlock
        let secret_hash = self.compute_sha256(&secret);
        let expected_hash = if self.hashlock.starts_with("0x") {
            self.hashlock.clone()
        } else {
            format!("0x{}", self.hashlock)
        };

        require!(
            secret_hash.to_lowercase() == expected_hash.to_lowercase(),
            "Invalid secret"
        );

        // Check timelock
        let current_time = env::block_timestamp_ms() / 1000;
        require!(
            current_time >= self.withdrawal_timelock,
            "Withdrawal timelock not met"
        );

        // Update state
        self.is_withdrawn = true;
        self.revealed_secret = Some(secret.clone());

        log!(
            "HTLC Withdrawal: order_hash={}, secret={}, taker_evm={}",
            self.order_hash,
            secret,
            self.taker_evm_address
        );

        // Transfer funds to maker
        Promise::new(self.maker.clone()).transfer(NearToken::from_near(self.amount.0))
    }

    /// Cancel escrow and return funds (equivalent to cancel in Solidity)
    /// No order_hash needed - this contract IS the escrow
    pub fn cancel(&mut self) -> Promise {
        require!(!self.is_withdrawn, "Already withdrawn");
        require!(!self.is_cancelled, "Already cancelled");

        // Check cancellation timelock
        let current_time = env::block_timestamp_ms() / 1000;
        require!(
            current_time >= self.cancellation_timelock,
            "Cancellation timelock not met"
        );

        // Update state
        self.is_cancelled = true;

        log!(
            "HTLC Cancelled: order_hash={}, refunded_to={}",
            self.order_hash,
            self.depositor
        );

        // Refund to depositor
        Promise::new(self.depositor.clone()).transfer(NearToken::from_near(self.deposited_amount.0))
    }

    /// View functions - like Solidity public variables
    pub fn get_order_hash(&self) -> String {
        self.order_hash.clone()
    }

    pub fn get_hashlock(&self) -> String {
        self.hashlock.clone()
    }

    pub fn get_maker(&self) -> AccountId {
        self.maker.clone()
    }

    pub fn get_taker_evm_address(&self) -> String {
        self.taker_evm_address.clone()
    }

    pub fn get_amount(&self) -> U128 {
        self.amount
    }

    pub fn get_safety_deposit(&self) -> U128 {
        self.safety_deposit
    }

    pub fn get_withdrawal_timelock(&self) -> u64 {
        self.withdrawal_timelock
    }

    pub fn get_cancellation_timelock(&self) -> u64 {
        self.cancellation_timelock
    }

    pub fn get_target_chain_id(&self) -> u8 {
        self.target_chain_id
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
        self.created_at
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

    /// Emergency function for depositor to handle stuck funds (with timelock)
    pub fn emergency_refund(&mut self) -> Promise {
        require!(
            env::predecessor_account_id() == self.depositor,
            "Only depositor can emergency refund"
        );

        // Only allow after significant time has passed
        let current_time = env::block_timestamp_ms() / 1000;
        let emergency_timelock = self.cancellation_timelock + 86400; // +24 hours
        require!(
            current_time >= emergency_timelock,
            "Emergency timelock not met"
        );

        log!("Emergency refund: order_hash={}", self.order_hash);

        Promise::new(self.depositor.clone()).transfer(NearToken::from_near(self.deposited_amount.0))
    }

    /// Utility function to compute SHA256 hash
    fn compute_sha256(&self, input: &str) -> String {
        let hash = env::sha256(input.as_bytes());
        hex::encode(hash)
    }
}

/*
 * Tests for Direct HTLC Escrow Contract (No Maps)
 */
// #[cfg(test)]
// mod tests {
//     use super::*;
//     use near_sdk::test_utils::{accounts, VMContextBuilder};
//     use near_sdk::{testing_env, MockedBlockchain, NearToken};

//     fn get_context(predecessor: AccountId, deposit: NearToken) -> VMContextBuilder {
//         let mut builder = VMContextBuilder::new();
//         builder
//             .current_account_id(accounts(0))
//             .signer_account_id(predecessor.clone())
//             .predecessor_account_id(predecessor)
//             .attached_deposit(deposit);
//         builder
//     }

//     #[test]
//     fn test_create_escrow() {
//         let context = get_context(accounts(1), 1_000_000_000_000_000_000_000_000); // 1 NEAR
//         testing_env!(context.build());

//         let order_hash = "0x1234567890abcdef".to_string();
//         let hashlock = "0x".to_string() + &"a".repeat(64); // 32-byte hex
//         let maker = accounts(1);
//         let taker_evm_address = "0x742B15F0e4f1D8A8D1A8D8A8D1A8D8A8D1A8D8A8".to_string();
//         let amount = U128(500_000_000_000_000_000_000_000); // 0.5 NEAR
//         let safety_deposit = U128(100_000_000_000_000_000_000_000); // 0.1 NEAR
//         let withdrawal_timelock = 9999999999; // Far future
//         let cancellation_timelock = 19999999999; // Even further future
//         let target_chain_id = 1;

//         let contract = HTLCEscrow::new(
//             order_hash.clone(),
//             hashlock,
//             maker,
//             taker_evm_address,
//             amount,
//             safety_deposit,
//             withdrawal_timelock,
//             cancellation_timelock,
//             target_chain_id,
//         );

//         assert_eq!(contract.get_order_hash(), order_hash);
//         assert_eq!(contract.get_amount(), amount);
//         assert!(contract.is_active());
//         assert!(!contract.is_withdrawn());
//         assert!(!contract.is_cancelled());
//     }

//     #[test]
//     fn test_withdraw_with_correct_secret() {
//         let context = get_context(accounts(1), 1_000_000_000_000_000_000_000_000);
//         testing_env!(context.build());

//         let secret = "mysecret";
//         let secret_hash = hex::encode(near_sdk::env::sha256(secret.as_bytes()));

//         let order_hash = "0x1234567890abcdef".to_string();
//         let maker = accounts(2);
//         let taker_evm_address = "0x742B15F0e4f1D8A8D1A8D8A8D1A8D8A8D1A8D8A8".to_string();
//         let amount = U128(500_000_000_000_000_000_000_000);
//         let safety_deposit = U128(100_000_000_000_000_000_000_000);
//         let withdrawal_timelock = 1; // Allow immediate withdrawal for test
//         let cancellation_timelock = 9999999999;
//         let target_chain_id = 1;

//         let mut contract = HTLCEscrow::new(
//             order_hash,
//             secret_hash,
//             maker,
//             taker_evm_address,
//             amount,
//             safety_deposit,
//             withdrawal_timelock,
//             cancellation_timelock,
//             target_chain_id,
//         );

//         // Withdraw with correct secret
//         contract.withdraw(secret.to_string());

//         assert!(contract.is_withdrawn());
//         assert_eq!(contract.get_revealed_secret().unwrap(), secret);
//         assert!(!contract.is_active());
//     }

//     #[test]
//     #[should_panic(expected = "Invalid secret")]
//     fn test_withdraw_with_wrong_secret() {
//         let context = get_context(accounts(1), 1_000_000_000_000_000_000_000_000);
//         testing_env!(context.build());

//         let order_hash = "0x1234567890abcdef".to_string();
//         let hashlock = "0x".to_string() + &"a".repeat(64); // Different hash
//         let maker = accounts(2);
//         let taker_evm_address = "0x742B15F0e4f1D8A8D1A8D8A8D1A8D8A8D1A8D8A8".to_string();
//         let amount = U128(500_000_000_000_000_000_000_000);
//         let safety_deposit = U128(100_000_000_000_000_000_000_000);
//         let withdrawal_timelock = 1;
//         let cancellation_timelock = 9999999999;
//         let target_chain_id = 1;

//         let mut contract = HTLCEscrow::new(
//             order_hash,
//             hashlock,
//             maker,
//             taker_evm_address,
//             amount,
//             safety_deposit,
//             withdrawal_timelock,
//             cancellation_timelock,
//             target_chain_id,
//         );

//         contract.withdraw("wrongsecret".to_string());
//     }

//     #[test]
//     fn test_cancel_escrow() {
//         let context = get_context(accounts(1), 1_000_000_000_000_000_000_000_000);
//         testing_env!(context.build());

//         let order_hash = "0x1234567890abcdef".to_string();
//         let hashlock = "0x".to_string() + &"a".repeat(64);
//         let maker = accounts(2);
//         let taker_evm_address = "0x742B15F0e4f1D8A8D1A8D8A8D1A8D8A8D1A8D8A8".to_string();
//         let amount = U128(500_000_000_000_000_000_000_000);
//         let safety_deposit = U128(100_000_000_000_000_000_000_000);
//         let withdrawal_timelock = 9999999999;
//         let cancellation_timelock = 1; // Allow immediate cancellation for test
//         let target_chain_id = 1;

//         let mut contract = HTLCEscrow::new(
//             order_hash,
//             hashlock,
//             maker,
//             taker_evm_address,
//             amount,
//             safety_deposit,
//             withdrawal_timelock,
//             cancellation_timelock,
//             target_chain_id,
//         );

//         contract.cancel();

//         assert!(contract.is_cancelled());
//         assert!(!contract.is_active());
//         assert_eq!(contract.get_status(), "cancelled");
//     }
// }

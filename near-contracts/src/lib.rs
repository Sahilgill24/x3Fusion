use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, NearToken, Promise};

#[derive(Serialize, Deserialize)]
#[near(contract_state)]
pub struct Escrow {
    arbiter: AccountId,
    beneficiary: AccountId,
    depositor: AccountId,
    amount: Option<u128>,
}

impl Default for Escrow {
    fn default() -> Self {
        env::panic_str("Contract should be initialized before usage");
    }
}

#[near]
impl Escrow {
    /// Initialize with arbiter and beneficiary; caller becomes depositor
    #[init]
    pub fn new(arbiter: AccountId, beneficiary: AccountId) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        let depositor = env::predecessor_account_id();
        Self {
            arbiter,
            beneficiary,
            depositor,
            amount: None,
        }
    }

    /// Depositor attaches NEAR to deposit into escrow
    #[payable]
    pub fn deposit(&mut self) {
        assert!(self.amount.is_none(), "Already deposited");
        let amount = env::attached_deposit().as_near();

        assert!(amount > 0, "Deposit must be > 0");
        self.amount = Some(amount);
    }

    /// Only arbiter can release funds to beneficiary
    pub fn release(&mut self) {
        assert_eq!(env::predecessor_account_id(), self.arbiter, "Only arbiter");
        let amount = self.amount.take().expect("Nothing to release");
        Promise::new(self.beneficiary.clone()).transfer(NearToken::from_yoctonear(amount));
    }

    /// Only arbiter can refund funds to depositor
    pub fn refund(&mut self) {
        assert_eq!(env::predecessor_account_id(), self.arbiter, "Only arbiter");
        let amount = self.amount.take().expect("Nothing to refund");
        Promise::new(self.depositor.clone()).transfer(NearToken::from_yoctonear(amount));
    }

    /// View details
    pub fn get_details(&self) -> (AccountId, AccountId, AccountId, Option<u128>) {
        (
            self.arbiter.clone(),
            self.beneficiary.clone(),
            self.depositor.clone(),
            self.amount,
        )
    }
}

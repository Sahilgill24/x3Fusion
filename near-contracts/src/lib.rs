// Find all our documentation at https://docs.near.org
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{log, near, AccountId, Timestamp};

#[near(contract_state)]
pub struct Escrow {
    pub owner: AccountId
}

#[near]
impl Escrow {
    
}

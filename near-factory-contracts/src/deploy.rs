use near_sdk::serde::Serialize;
use near_sdk::{env, log, near, AccountId, NearToken, Promise, PromiseError, PublicKey};

use crate::{Contract, ContractExt, NEAR_PER_STORAGE, TGAS};

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct EscrowInitArgs {
    order_hash: String,
    hashlock: String,
    maker: AccountId,
    taker_evm_address: String,
    amount: String,         // U128 as string
    safety_deposit: String, // U128 as string
    withdrawal_timelock: u64,
    public_withdrawal_timelock: u64,
    cancellation_timelock: u64,
}

#[near]
impl Contract {
    #[payable]
    pub fn create_factory_subaccount_and_deploy(
        &mut self,
        name: String,
        order_hash: String,
        hashlock: String,
        maker: AccountId,
        taker_evm_address: String,
        amount: String,         // U128 as string
        safety_deposit: String, // U128 as string
        withdrawal_timelock: u64,
        public_withdrawal_timelock: u64,
        cancellation_timelock: u64,
        public_key: Option<PublicKey>,
    ) -> Promise {
        // Assert the sub-account is valid
        let current_account = env::current_account_id().to_string();
        let subaccount: AccountId = format!("{name}.{current_account}").parse().unwrap();
        assert!(
            env::is_valid_account_id(subaccount.as_bytes()),
            "Invalid subaccount"
        );

        // Assert enough tokens are attached to create the account and deploy the contract
        let attached = env::attached_deposit();

        let code = self.code.clone().unwrap();
        let contract_bytes = code.len() as u128;
        let contract_storage_cost = NEAR_PER_STORAGE.saturating_mul(contract_bytes);
        let account_creation_cost =
            contract_storage_cost.saturating_add(NearToken::from_millinear(100));

        // Parse the escrow amounts
        let escrow_amount: u128 = amount.parse().unwrap();
        let safety_amount: u128 = safety_deposit.parse().unwrap();
        let escrow_deposit = NearToken::from_yoctonear(escrow_amount + safety_amount);

        // Total needed = account creation + escrow deposit
        let total_needed = account_creation_cost.saturating_add(escrow_deposit);
        assert!(
            attached >= total_needed,
            "Attach at least {total_needed} yⓃ"
        );

        let init_args = near_sdk::serde_json::to_vec(&EscrowInitArgs {
            order_hash,
            hashlock,
            maker,
            taker_evm_address,
            amount,
            safety_deposit,
            withdrawal_timelock,
            public_withdrawal_timelock,
            cancellation_timelock,
        })
        .unwrap();

        let mut promise = Promise::new(subaccount.clone())
            .create_account()
            .transfer(account_creation_cost) // Only transfer what's needed for account
            .deploy_contract(code)
            .function_call(
                "new".to_owned(),
                init_args,
                escrow_deposit, // Pass the escrow amount as deposit
                TGAS.saturating_mul(5),
            );

        // Add full access key is the user passes one
        if let Some(pk) = public_key {
            promise = promise.add_full_access_key(pk);
        }

        // Add callback
        promise.then(
            Self::ext(env::current_account_id()).create_factory_subaccount_and_deploy_callback(
                subaccount,
                env::predecessor_account_id(),
                attached,
            ),
        )
    }

    #[private]
    pub fn create_factory_subaccount_and_deploy_callback(
        &mut self,
        account: AccountId,
        user: AccountId,
        attached: NearToken,
        #[callback_result] create_deploy_result: Result<(), PromiseError>,
    ) -> bool {
        if let Ok(_result) = create_deploy_result {
            log!("Correctly created and deployed to {account}");
            return true;
        };

        log!("Error creating {account}, returning {attached}yⓃ to {user}");
        Promise::new(user).transfer(attached);
        false
    }
}

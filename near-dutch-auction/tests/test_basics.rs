use near_sdk::json_types::U128;
use serde_json::json;

#[tokio::test]
async fn test_dutch_auction_calculator() -> Result<(), Box<dyn std::error::Error>> {
    let contract_wasm = near_workspaces::compile_project("./").await?;

    test_dutch_auction_on(&contract_wasm).await?;
    Ok(())
}

async fn test_dutch_auction_on(contract_wasm: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
    let sandbox = near_workspaces::sandbox().await?;
    let contract = sandbox.dev_deploy(contract_wasm).await?;

    // Initialize the contract
    let init_outcome = contract.call("new").transact().await?;
    assert!(
        init_outcome.is_success(),
        "{:#?}",
        init_outcome.into_result().unwrap_err()
    );

    // Test price calculation
    let start_time = 0u64; // start at 0 ms
    let end_time = 1000u64; // end at 1000 ms
    let start_price = U128::from(1000u128);
    let end_price = U128::from(500u128);

    let price_outcome = contract
        .view("calc_price")
        .args_json(json!({
            "start_time": start_time,
            "end_time": end_time,
            "start_price": start_price,
            "end_price": end_price
        }))
        .await?;

    // We need to check what the current block timestamp is in the test environment
    // to determine what price we expect

    // Test order hash creation
    let order = json!({
        "salt": 12345,
        "maker": contract.id(),
        "maker_asset": "NEAR",
        "making_amount": U128::from(1_000_000_000_000_000_000_000_000u128) // 1 NEAR
    });

    let hash_outcome = contract
        .view("hash_order")
        .args_json(json!({
            "order": order
        }))
        .await?;

    let hash = hash_outcome.json::<String>()?;
    assert!(!hash.is_empty(), "Order hash should not be empty");

    // Test price info
    let price_info_outcome = contract
        .view("get_price_info")
        .args_json(json!({
            "order": order,
            "start_time": start_time,
            "end_time": end_time,
            "start_price": start_price,
            "end_price": end_price
        }))
        .await?;

    let price_info = price_info_outcome.json::<serde_json::Value>()?;
    assert!(
        price_info.get("order_hash").is_some(),
        "Price info should include order hash"
    );
    assert!(
        price_info.get("current_price").is_some(),
        "Price info should include current price"
    );
    assert!(
        price_info.get("time_elapsed_percent").is_some(),
        "Price info should include time elapsed percent"
    );
    assert!(
        price_info.get("is_active").is_some(),
        "Price info should include is_active flag"
    );

    Ok(())
}

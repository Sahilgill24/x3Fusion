// ed25519:bwF1ZW7nTrnKNN9gEMdmB9iHRE21ED2pKJuaNGWF2ia trial3.testnet 

import { Account } from "@near-js/accounts";
import { JsonRpcProvider } from "@near-js/providers";
import { KeyPairSigner } from "@near-js/signers";
import { parseNearAmount } from "@near-js/utils";


const privatekey = 'ed25519:3hHwBa3fqM34dRhUbnQgdFbpQTKGzh5sAK3doKaQaon1uNvjH1bD744QUw9Ek9M2qBZoKmt2Ddi14WAPLoYcuxhM'
const signer = KeyPairSigner.fromSecretKey(privatekey);

const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" })
const account = new Account("trial45.testnet", provider, signer);

// Create a unique salt (typically a random number or timestamp)
const salt = Math.floor(Math.random() * 1000000);

// Create order - maker will be the current account
const order = {
    salt: salt,
    maker: 'trial45.testnet',
    maker_asset: 'NEAR',
    making_amount: parseNearAmount('1')  // 1 NEAR
};

// Define auction time parameters
// Start now and run for 1 hour
const now = Math.floor(Date.now());
const startTime = now;  // Start time in ms (from now)
const endTime = now + 3600000;  // End time in ms (1 hour from start)

// Set auction prices
const startPrice = parseNearAmount('10');  // 10 NEAR
const endPrice = parseNearAmount('5');     // 5 NEAR




// Function to create an order and get its hash
async function createOrder() {
    try {


        // First, get the hash of this order for tracking
        const hash = await account.callFunction({
            contractId: 'dutchauction22.testnet',
            methodName: 'hash_order',
            args: { order }
        });

        console.log("Created order with hash:", hash);
        return hash;
    } catch (error) {
        console.error("Error creating order:", error);
        throw error;
    }
}


// Function to get current price info for an order
async function getPriceInfo() {
    try {
        const priceInfo = await account.callFunction({
            contractId: 'dutchauction22.testnet',
            methodName: 'get_price_info',
            args: {
                order,
                start_time: startTime,
                end_time: endTime,
                start_price: startPrice,
                end_price: endPrice
            }
        });

        console.log("Price Info:", priceInfo);
        console.log("Current Price:", priceInfo.current_price);
        console.log("Time Elapsed:", priceInfo.time_elapsed_percent + "%");
        console.log("Is Active:", priceInfo.is_active);

        return priceInfo;
    } catch (error) {
        console.error("Error getting price info:", error);
        throw error;
    }
}


// Function to fill an order at the current auction price
async function fillOrder(takerAccountId) {
    try {
        // Default taker if not provided
        const taker = takerAccountId || 'taker.testnet';

        console.log(`Filling order as ${taker}...`);

        // Call the fill_order function on the contract
        const filledOrderInfo = await account.callFunction({
            contractId: 'dutchauction22.testnet',
            methodName: 'fill_order',
            args: {
                order,
                taker,
                start_time: startTime,
                end_time: endTime,
                start_price: startPrice,
                end_price: endPrice
            }
        });

        console.log("Order filled successfully!");
        console.log("Filled order details:", filledOrderInfo);
        console.log("Fill price:", filledOrderInfo.fill_price);
        console.log("Order hash:", filledOrderInfo.order_hash);

        return filledOrderInfo;
    } catch (error) {
        console.error("Error filling order:", error);
        throw error;
    }
}
// Main function to demonstrate the full flow
async function runDutchAuction(shouldFill = false, takerAccountId = null) {
    try {
        // 1. Create the order and get its hash
        const orderHash = await createOrder();
        console.log("Order created with hash:", orderHash);

        // 2. Get the current price information
        const priceInfo = await getPriceInfo();

        // 3. If shouldFill is true, fill the order
        let filledOrderInfo = null;
        if (shouldFill) {
            filledOrderInfo = await fillOrder(takerAccountId);
            console.log("Order has been filled!");
        } else {
            console.log("Dutch auction is ready for cross-chain fulfillment");
            console.log("Store this hash for verification:", orderHash);
        }

        return { orderHash, priceInfo, filledOrderInfo };
    } catch (error) {
        console.error("Dutch auction execution failed:", error);
        throw error;
    }
}

// Execute the auction flow
// Set first parameter to true to automatically fill the order
// Second parameter is optional taker account ID
runDutchAuction(false).catch(console.error);
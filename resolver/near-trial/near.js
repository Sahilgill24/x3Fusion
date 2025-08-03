
// ed25519:bwF1ZW7nTrnKNN9gEMdmB9iHRE21ED2pKJuaNGWF2ia trial3.testnet 

import { Account } from "@near-js/accounts";
import { JsonRpcProvider } from "@near-js/providers";
import { KeyPairSigner } from "@near-js/signers";
import { NEAR } from "@near-js/tokens";


const privatekey = 'ed25519:4uWo16xLoUqYQ5oN4FhAqXYvxxt3haL86mVWudp7W1mw23m3FykA7gWCrSsnkYhceyJcsjuTdKNDR3K7EfGgtuMG'
const signer = KeyPairSigner.fromSecretKey(privatekey);

const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" })
const account = new Account("trial3.testnet", provider, signer);


async function factory() {
    const result = await account.callFunction({
        contractId: "escrowfac22.testnet",
        methodName: "create_factory_subaccount_and_deploy",
        args: {
            name : "uniquename234",
            order_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", // 32-byte hash (64 hex chars)
            hashlock: "0xa665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3", // 32-byte hash
            maker: "othercap7803.testnet", // NEAR account ID
            taker_evm_address: "0x6F1859694601891B7ED021c3Fefd390AB776d5C0", // EVM address as string
            amount: "1000000000000000000000000", // Amount in yoctoNEAR (1 NEAR)
            safety_deposit: "1000000000000000000000", // Safety deposit in yoctoNEAR (0.1 NEAR)
            withdrawal_timelock: Math.floor(Date.now() / 1000) + 20, // 30 minutes from now (minimum required)
            public_withdrawal_timelock: Math.floor(Date.now() / 1000)+ 30, // 1 hour from now
            cancellation_timelock: Math.floor(Date.now() / 1000) + 7201,
            publickey: null, // 2 hours from now
        },
        deposit: "2800000000000000000000000", // Total deposit in yoctoNEAR (1.1 NEAR)
        gas: "50000000000000",
        
    }
    )
    console.log("New contract result:", result);
    
}

async function main() {
    // const result1 = await provider.viewAccount("trial3.testnet")
    // console.log("Account details:", result1);
    // I can transfer NEAR tokens like this as well USDT or anyother FT
    // await account.transfer({
    //     token: NEAR,
    //     amount: NEAR.toUnits("0.1"),
    //     receiverId: "receiver.testnet",
    // })

    // const result = await account.callFunction({
    //     contractId: "escrow-unitedefi.testnet",
    //     methodName: "new",
    //     args: {
    //         order_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", // 32-byte hash (64 hex chars)
    //         hashlock: "0xa665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3", // 32-byte hash
    //         maker: "othercap7803.testnet", // NEAR account ID
    //         taker_evm_address: "0x6F1859694601891B7ED021c3Fefd390AB776d5C0", // EVM address as string
    //         amount: "1000000000000000000000000", // Amount in yoctoNEAR (1 NEAR)
    //         safety_deposit: "1000000000000000000000", // Safety deposit in yoctoNEAR (0.1 NEAR)
    //         withdrawal_timelock: Math.floor(Date.now() / 1000) + 20, // 30 minutes from now (minimum required)
    //         public_withdrawal_timelock: Math.floor(Date.now() / 1000)+ 30, // 1 hour from now
    //         cancellation_timelock: Math.floor(Date.now() / 1000) + 7201 // 2 hours from now
    //     },
    //     deposit: "1100000000000000000000000", // Total deposit in yoctoNEAR (1.1 NEAR)
    //     gas: "30000000000000"
    // }
    // )

    const result2 = await account.callFunction({
        contractId: "escrow-unitedefi.testnet",
        methodName: "withdraw",
        args: {
            secret: "123",

        },
        gas: "30000000000000"

    })
    //console.log("New contract result:", result);
    console.log("Withdraw result:", result2);

}





factory()
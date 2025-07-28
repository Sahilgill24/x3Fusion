
// ed25519:bwF1ZW7nTrnKNN9gEMdmB9iHRE21ED2pKJuaNGWF2ia trial3.testnet 

import { Account } from "@near-js/accounts";
import { JsonRpcProvider } from "@near-js/providers";
import { KeyPairSigner } from "@near-js/signers";
import { NEAR } from "@near-js/tokens";


const privatekey = 'ed25519:4uWo16xLoUqYQ5oN4FhAqXYvxxt3haL86mVWudp7W1mw23m3FykA7gWCrSsnkYhceyJcsjuTdKNDR3K7EfGgtuMG'
const signer = KeyPairSigner.fromSecretKey(privatekey);

const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" })
const account = new Account("trial3.testnet", provider, signer);


async function main() {
    // const result1 = await provider.viewAccount("trial3.testnet")
    // console.log("Account details:", result1);
    // I can transfer NEAR tokens like this as well USDT or anyother FT
    // await account.transfer({
    //     token: NEAR,
    //     amount: NEAR.toUnits("0.1"),
    //     receiverId: "receiver.testnet",
    // })

    const result = await account.callFunction({
        contractId: "trial3.testnet",
        methodName: "deposit",
        args: {

        },
        deposit: NEAR.toUnits("1"),
        gas: "30000000000000"
    })
    console.log("Deposit result:", result);




}


main()
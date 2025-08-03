import { TezosToolkit } from "@taquito/taquito";
import { InMemorySigner } from '@taquito/signer';
import { stringToBytes } from "@taquito/utils";


const Tezos = new TezosToolkit('https://rpc.ghostnet.teztnets.com');
// KT1Q6AHk6xcQ2KzSQYvSkVfhLuXYEvTsbiQT without timelocks contract
// KT1VARvwmbxQGUQeMmFmowLN16rFWxLB5iik with timelocks contract
// working contract: KT1Uko3geJLiW2Dx5UHrGJG5g2po9z4Novwh

Tezos.setProvider({ signer: await InMemorySigner.fromSecretKey('edskSApXsFmrqD7HvgZWoGHnSso1szmg4NYjwS8Mmx2ripVt9dhFzvmqozEyBgTUD9vRAQMQv7uu7YaoWMG1sBMmcsfW1zvBU3') });

async function initializeEscrow(contractAddress, params) {
    const contract = await Tezos.contract.at(contractAddress);

    const initParams = {
        order_hash: stringToBytes(params.orderHash),
        hashlock: params.hashlock, // Don't convert to bytes here - pass the hex string directly
        maker: params.makerAddress,
        taker_address: params.takerAddress,
        amount: params.amount * 1000000, // Convert XTZ to mutez
        safety_deposit: params.safetyDeposit * 1000000,
        withdrawal_timelock: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
        public_withdrawal_timelock: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        cancellation_timelock: Math.floor(Date.now() / 1000) + 7200 // 2 hours
    };

    const result = await contract.methodsObject.initialize_escrow(initParams).send();
    console.log("Escrow initialized:", await result.confirmation());
    return result;
}

// Deposit funds to escrow
async function deposit(contractAddress, amount, safetyDeposit) {
    const contract = await Tezos.contract.at(contractAddress);

    const totalAmount = (amount + safetyDeposit) * 1000000; // Convert to mutez

    const result = await contract.methodsObject.deposit().send({
        amount: totalAmount,
        mutez: true
    });

    console.log("Deposit confirmed:", await result.confirmation());
    return result;
}

// Withdraw with secret (private withdrawal by maker)
async function withdraw(contractAddress, secret) {
    const contract = await Tezos.contract.at(contractAddress);

    const secretBytes = stringToBytes(secret);

    const result = await contract.methodsObject.withdraw(secretBytes).send();
    console.log("Withdrawal confirmed:", await result.confirmation());
    return result;
}


async function example() {
    const contractAddress = "KT1GgpmpC8fvnBrTMCP775p7n1rvGd5ErSDk";
    // KT1Uko3geJLiW2Dx5UHrGJG5g2po9z4Novwh
    //Initialize escrow
    await initializeEscrow(contractAddress, {
        orderHash: "0x001234567890abcdef",
        hashlock: "0xa665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3", // SHA256 of "123" - correct hash
        makerAddress: "tz1a4XeitzFQL5kKXtEYdC7ptmPWJwDD12XN",
        takerAddress: "0x6F1859694601891B7ED021c3Fefd390AB776d5C0",
        amount: 1.0, // 1 XTZ
        safetyDeposit: 0.1 // 0.1 XTZ
    });

    // Deposit funds
    await deposit(contractAddress, 1.0, 0.1);

    // Withdraw with secret
    await withdraw(contractAddress, "123");
}

example()
// async function factory() {
//     const contract = await Tezos.contract.at('KT1Vig7TYWAVNCGydaTnMTbnBaQdsxSBESFS');
//     console.log("Factory contract address:", contract.entrypoints);
//     const result = await contract.methodsObject.create2().send({
//         amount: 1230,
//     });
//     console.log("Factory contract interaction result:", await result.confirmation());
// }

// factory()
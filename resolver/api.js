// This is an API endpoint for managing the cross-chain escrows and all the stuff. 
// 


const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { Account } = require("@near-js/accounts");
const { JsonRpcProvider } = require("@near-js/providers");
const { KeyPairSigner } = require("@near-js/signers");
const { TezosToolkit } = require("@taquito/taquito");
const { InMemorySigner } = require('@taquito/signer');
const { stringToBytes } = require("@taquito/utils");
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Load ABIs
const evmFactoryAbi = require('./resolver/abi/abi.json');
const evmEscrowAbi = require('./resolver/abi/EvmEscrow.json');

// EVM Configuration
const EVM_CONFIG = {
    rpc: 'https://eth-sepolia.public.blastapi.io',
    factoryAddress: '0x49ae5957c37f993667c676dcfad35cfAa9Fbc563',
    privateKey: '0x39d7e9850a20b12f20dc2476f274fe429f5c44ed54a151e93d49d91c19a1f426'
};
// 0x39d7e9850a20b12f20dc2476f274fe429f5c44ed54a151e93d49d91c19a1f426
// NEAR Configuration
const NEAR_CONFIG = {
    rpc: "https://test.rpc.fastnear.com",
    privateKey: 'ed25519:3hHwBa3fqM34dRhUbnQgdFbpQTKGzh5sAK3doKaQaon1uNvjH1bD744QUw9Ek9M2qBZoKmt2Ddi14WAPLoYcuxhM',
    accountId: "trial45.testnet",
    factoryId: "escrowfac22.testnet"
};

// Tezos Configuration
const TEZOS_CONFIG = {
    rpc: 'https://rpc.ghostnet.teztnets.com',
    privateKey: 'edskSApXsFmrqD7HvgZWoGHnSso1szmg4NYjwS8Mmx2ripVt9dhFzvmqozEyBgTUD9vRAQMQv7uu7YaoWMG1sBMmcsfW1zvBU3'
};

// Initialize providers
const evmProvider = new ethers.JsonRpcProvider(EVM_CONFIG.rpc);
const evmSigner = new ethers.Wallet(EVM_CONFIG.privateKey, evmProvider);
const evmFactoryContract = new ethers.Contract(EVM_CONFIG.factoryAddress, evmFactoryAbi.abi, evmSigner);
const signer2 = new ethers.Wallet('0xa7788f91928410e6ebd73c01457ed9e77123719ea98bd50b23d99c3b214a9482', evmProvider);
const nearProvider = new JsonRpcProvider({ url: NEAR_CONFIG.rpc });
const nearSigner = KeyPairSigner.fromSecretKey(NEAR_CONFIG.privateKey);
const nearAccount = new Account(NEAR_CONFIG.accountId, nearProvider, nearSigner);

const tezos = new TezosToolkit(TEZOS_CONFIG.rpc);



// working fine
// EVM Escrow Deployment Endpoint
app.post('/deploy/evm', async (req, res) => {
    try {
        const {
            orderHash,
            maker,
            taker,
            token,
            amount,
            safetyDeposit,
            withdrawalPeriod = 0,
            cancellationPeriod = 3600,
            secret,
        } = req.body;

        // Use exact same secret as resolver.js
        const secretString = secret || 'my_secret_123'; // Default to resolver.js secret
        const secretBytes32 = ethers.zeroPadValue(ethers.toUtf8Bytes(secretString), 32);
        const hashlock = ethers.sha256(secretBytes32);

        // Exact same timelock calculation as resolver.js
        const escrowCreationTime = Math.floor(Date.now() / 1000);
        const dstWithdrawal = withdrawalPeriod;
        const dstPublicWithdrawal = withdrawalPeriod * 2;
        const dstCancellation = cancellationPeriod;

        const timelocks = (BigInt(escrowCreationTime) << 224n) |
            (BigInt(dstCancellation) << 64n) |
            (BigInt(dstPublicWithdrawal) << 32n) |
            BigInt(dstWithdrawal);
        // 0x6F1859694601891B7ED021c3Fefd390AB776d5C0
        // Exact same order object as resolver.js
        const order = {
            orderHash: orderHash || ethers.keccak256(ethers.toUtf8Bytes('unique_order_123')),
            hashlock: hashlock,
            maker: maker || '0xdC9ab498f858c3fd7A241C1B1F326E64586B4Fce',
            taker: taker || '0x6F1859694601891B7ED021c3Fefd390AB776d5C0',
            token: token || '0x0000000000000000000000000000000000000000',
            amount: ethers.parseEther(amount || '0.001'),
            safetyDeposit: ethers.parseEther(safetyDeposit || '0.0001'),
            timelocks: timelocks
        };

        // Exact same deployment logic as resolver.js
        const factoryWithSigner = evmFactoryContract.connect(evmSigner);
        const deploymentOrder = {
            ...order,
            timelocks: timelocks
        };

        const isEthToken = deploymentOrder.token === '0x0000000000000000000000000000000000000000';
        const requiredForEscrow = isEthToken
            ? deploymentOrder.amount + deploymentOrder.safetyDeposit
            : deploymentOrder.safetyDeposit;

        const creationFee = await evmFactoryContract.creationFee();
        const totalRequired = requiredForEscrow + creationFee;

        console.log('Creation fee:', ethers.formatEther(creationFee));
        console.log('Required for escrow:', ethers.formatEther(requiredForEscrow));
        console.log('Total required:', ethers.formatEther(totalRequired));

        const tx = await factoryWithSigner.createEscrow(deploymentOrder, {
            value: totalRequired,
            gasLimit: 500000
        });

        const receipt = await tx.wait();

        const escrowCreatedEvent = receipt.logs.find(log => {
            try {
                const parsed = evmFactoryContract.interface.parseLog(log);
                return parsed.name === 'EscrowCreated';
            } catch (e) {
                return false;
            }
        });

        const parsedEvent = evmFactoryContract.interface.parseLog(escrowCreatedEvent);
        const escrowAddress = parsedEvent.args[0];

        // Save order details to evmdeploy.json for withdrawal
        const deploymentData = {
            transactionHash: tx.hash,
            escrowAddress,
            order: {
                orderHash: order.orderHash,
                hashlock: order.hashlock,
                maker: order.maker,
                taker: order.taker,
                token: order.token,
                amount: order.amount.toString(),
                safetyDeposit: order.safetyDeposit.toString(),
                timelocks: order.timelocks.toString()
            },
            secret: secretString,
            creationFee: creationFee.toString(),
            totalRequired: totalRequired.toString(),
            deployedAt: new Date().toISOString()
        };

        // Write to evmdeploy.json
        fs.writeFileSync(path.join(__dirname, 'evmdeploy.json'), JSON.stringify(deploymentData, null, 2));

        res.json({
            transactionHash: tx.hash,
            escrowAddress,
            hashlock,
            creationFee: creationFee.toString(),
            totalRequired: totalRequired.toString(),
            orderSavedTo: 'evmdeploy.json'
        });

    } catch (error) {
        console.error('EVM deployment error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// NEAR Escrow Deployment Endpoint
app.post('/deploy/near', async (req, res) => {
    try {
        const {
            orderHash,
            maker,
            takerEvmAddress,
            amount,
            safetyDeposit,
            withdrawalPeriod = 10,
            cancellationPeriod = 7201,
            uniqueName,
            secret
        } = req.body;

        // Use exact same function call as near.js
        const hash = ethers.sha256(ethers.toUtf8Bytes(secret));
        const result = await nearAccount.callFunction({
            contractId: "escrowfac22.testnet",
            methodName: "create_factory_subaccount_and_deploy",
            args: {
                name: uniqueName || "randomname",
                order_hash: orderHash || "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                hashlock: hash || "0xa665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
                maker: maker || "othercap7803.testnet",
                taker_evm_address: takerEvmAddress || "0x6F1859694601891B7ED021c3Fefd390AB776d5C0",
                amount: amount || "100000000000000000000000",
                safety_deposit: safetyDeposit || "100000000000000000000",
                withdrawal_timelock: Math.floor(Date.now() / 1000) + withdrawalPeriod,
                public_withdrawal_timelock: Math.floor(Date.now() / 1000) + 30,
                cancellation_timelock: Math.floor(Date.now() / 1000) + cancellationPeriod,
                publickey: null,
            },
            deposit: "2800000000000000000000000",
            gas: "50000000000000",
        });

        res.json({
            success: true,
            network: 'NEAR',
            result,
            secret: secret || '123', // From near.js withdraw function
            contractName: `${uniqueName || "randomname"}.escrowfac22.testnet`
        });

    } catch (error) {
        console.error('NEAR deployment error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Tezos Escrow Deployment Endpoint
app.post('/deploy/tezos', async (req, res) => {
    try {
        const {
            orderHash,
            maker,
            takerAddress,
            amount,
            safetyDeposit,
            secret
        } = req.body;



        // Set up Tezos signer exactly like tezos.js
        await tezos.setProvider({
            signer: await InMemorySigner.fromSecretKey('edskSApXsFmrqD7HvgZWoGHnSso1szmg4NYjwS8Mmx2ripVt9dhFzvmqozEyBgTUD9vRAQMQv7uu7YaoWMG1sBMmcsfW1zvBU3')
        });
        // KT1KWQF6qz9cZNxFJwT1Hqf2xHuupYbZpJeF new one 
        const contract = await tezos.contract.at('KT1D9qehRdgVzEv1FgPNESB1DnxdekSdNbHN');
        const hash = ethers.sha256(ethers.toUtf8Bytes(secret));
        // Use exact same parameters as tezos.js
        // maker's tezos address needed here. 
        const initParams = {
            order_hash: stringToBytes("0x001234567890abcdef"),
            hashlock: hash || "0xa665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
            maker: maker || "tz1a4XeitzFQL5kKXtEYdC7ptmPWJwDD12XN",
            taker_address: takerAddress || "0x6F1859694601891B7ED021c3Fefd390AB776d5C0",
            amount: (parseFloat(amount || '1.0') * 1000000),
            safety_deposit: (parseFloat(safetyDeposit || '0.1') * 1000000),
            withdrawal_timelock: Math.floor(Date.now() / 1000) + 10,
            public_withdrawal_timelock: Math.floor(Date.now() / 1000) + 3600,
            cancellation_timelock: Math.floor(Date.now() / 1000) + 7200
        };

        // Initialize escrow exactly like tezos.js
        const initResult = await contract.methodsObject.initialize_escrow(initParams).send();
        const initConfirmation = await initResult.confirmation();

        // Deposit funds exactly like tezos.js
        const totalAmount = (parseFloat(amount || '1.0') + parseFloat(safetyDeposit || '0.1')) * 1000000;
        const depositResult = await contract.methodsObject.deposit().send({
            amount: totalAmount,
            mutez: true
        });
        const depositConfirmation = await depositResult.confirmation();

        res.json({
            success: true,
            network: 'Tezos',
            secret: secret || "123",
            EscrowAddress: 'KT1D9qehRdgVzEv1FgPNESB1DnxdekSdNbHN',
            initTransaction: {
                hash: initResult.hash,
                confirmation: initConfirmation
            },
            depositTransaction: {
                hash: depositResult.hash,
                confirmation: depositConfirmation
            },
            initParams
        });

    } catch (error) {
        console.error('Tezos deployment error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// EVM Escrow Withdrawal Endpoint
app.post('/withdraw/evm', async (req, res) => {
    try {
        const {
            escrowAddress,
            secret,
            isPublicWithdrawal = false,
            useStoredOrder = true
        } = req.body;

        if (!escrowAddress) {
            return res.status(400).json({
                success: false,
                error: 'Escrow address is required'
            });
        }

        if (!secret && !isPublicWithdrawal) {
            return res.status(400).json({
                success: false,
                error: 'Secret is required for private withdrawal'
            });
        }

        let order = null;
        let storedSecret = null;

        // Read order and secret from evmdeploy.json if useStoredOrder is true
        if (useStoredOrder && !isPublicWithdrawal) {
            try {
                const deploymentDataPath = path.join(__dirname, 'evmdeploy.json');
                if (fs.existsSync(deploymentDataPath)) {
                    const deploymentData = JSON.parse(fs.readFileSync(deploymentDataPath, 'utf8'));

                    // Check if this is the correct escrow
                    if (deploymentData.escrowAddress === escrowAddress) {
                        order = deploymentData.order;
                        storedSecret = deploymentData.secret;
                        console.log('Using stored order and secret from evmdeploy.json');
                        console.log('Stored secret:', storedSecret);
                    } else {
                        console.log('Escrow address mismatch, stored:', deploymentData.escrowAddress, 'requested:', escrowAddress);
                    }
                } else {
                    console.log('evmdeploy.json not found');
                }
            } catch (error) {
                console.log('Error reading evmdeploy.json:', error.message);
            }
        }

        // Use stored secret if available, otherwise use request secret
        const finalSecret = storedSecret || secret;

        // Update secret validation to use finalSecret
        if (!finalSecret && !isPublicWithdrawal) {
            return res.status(400).json({
                success: false,
                error: 'Secret is required for private withdrawal and not found in stored data'
            });
        }

        // If no stored order found and not public withdrawal, require order in request
        if (!order && !isPublicWithdrawal) {
            if (!req.body.order) {
                return res.status(400).json({
                    success: false,
                    error: 'Order object is required for private withdrawal when stored order is not available'
                });
            }
            order = req.body.order;
        }

        // Use signer2 like in resolver.js (this corresponds to the taker's private key)
        const escrowContract = new ethers.Contract(escrowAddress, evmEscrowAbi.abi, signer2);

        let tx;

        // Private withdrawal with secret and order (like in resolver.js)
        const secretBytes32 = ethers.zeroPadValue(ethers.toUtf8Bytes(finalSecret), 32);

        // Debug information
        console.log('=== WITHDRAWAL DEBUG ===');
        console.log('Final secret used:', finalSecret);
        console.log('Secret bytes32:', secretBytes32);
        console.log('Computed hashlock:', ethers.sha256(secretBytes32));
        console.log('Order hashlock:', order.hashlock);
        console.log('Hashlock match:', ethers.sha256(secretBytes32) === order.hashlock);
        console.log('Signer address:', await signer2.getAddress());
        console.log('Order maker:', order.maker);
        console.log('Order taker:', order.taker);

        // CRITICAL: We need to reconstruct the order with the ACTUAL deployment timestamp
        // Get the deployment transaction to find the actual timestamp
        let correctOrder = order;
        try {
            const deploymentDataPath = path.join(__dirname, 'evmdeploy.json');
            if (fs.existsSync(deploymentDataPath)) {
                const deploymentData = JSON.parse(fs.readFileSync(deploymentDataPath, 'utf8'));

                // Get the deployment transaction receipt
                const deploymentTx = await evmProvider.getTransactionReceipt(deploymentData.transactionHash);
                const deploymentBlock = await evmProvider.getBlock(deploymentTx.blockNumber);
                const actualDeploymentTimestamp = deploymentBlock.timestamp;

                console.log('Actual deployment timestamp:', actualDeploymentTimestamp);
                console.log('Original timelocks:', order.timelocks);

                // Reconstruct timelocks with actual deployment timestamp (like resolver.js does)
                const withdrawalPeriod = 0;
                const cancellationPeriod = 3600;
                const dstWithdrawal = withdrawalPeriod;
                const dstPublicWithdrawal = withdrawalPeriod * 2;
                const dstCancellation = cancellationPeriod;

                const correctedTimelocks = (BigInt(actualDeploymentTimestamp) << 224n) |
                    (BigInt(dstCancellation) << 64n) |
                    (BigInt(dstPublicWithdrawal) << 32n) |
                    BigInt(dstWithdrawal);

                console.log('Corrected timelocks:', correctedTimelocks.toString());

                // Use the corrected order (like deployedImmutables in resolver.js)
                correctOrder = {
                    ...order,
                    timelocks: correctedTimelocks.toString()
                };
            }
        } catch (timeLockError) {
            console.log('Could not reconstruct timelocks, using original:', timeLockError.message);
        }

        // Convert order object to proper format for contract
        const contractOrder = {
            orderHash: correctOrder.orderHash,
            hashlock: correctOrder.hashlock,
            maker: correctOrder.maker,
            taker: correctOrder.taker,
            token: correctOrder.token,
            amount: BigInt(correctOrder.amount),
            safetyDeposit: BigInt(correctOrder.safetyDeposit),
            timelocks: BigInt(correctOrder.timelocks)
        };

        console.log('Using contract order with timelocks:', contractOrder.timelocks.toString());

        tx = await escrowContract.withdraw(secretBytes32, contractOrder, {
            gasLimit: 500000
        });


        const receipt = await tx.wait();

        res.json({
            success: true,
            network: 'EVM',
            transactionHash: tx.hash,
            withdrawalType: isPublicWithdrawal ? 'public' : 'private',
            orderSource: useStoredOrder && order ? 'evmdeploy.json' : 'request body',
            receipt,
            secret: isPublicWithdrawal ? null : secret
        });

    } catch (error) {
        console.error('EVM withdrawal error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// NEAR Escrow Withdrawal Endpoint
app.post('/withdraw/near', async (req, res) => {
    try {
        const { contractId, secret } = req.body;

        if (!contractId) {
            return res.status(400).json({
                success: false,
                error: 'Contract ID is required'
            });
        }

        // Use exact same function call as near.js
        // withdraws to the maker's near account 
        const result = await nearAccount.callFunction({
            contractId: contractId,
            methodName: "withdraw",
            args: {
                secret: secret || "123",
            },
            gas: "30000000000000"
        });

        res.json({
            success: true,
            network: 'NEAR',
            contractId,
            result,
            secret: secret || "123"
        });

    } catch (error) {
        console.error('NEAR withdrawal error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Tezos Escrow Withdrawal Endpoint
app.post('/withdraw/tezos', async (req, res) => {
    try {
        const { contractAddress, secret } = req.body;

        if (!contractAddress) {
            return res.status(400).json({
                success: false,
                error: 'Contract address is required'
            });
        }
        await tezos.setProvider({
            signer: await InMemorySigner.fromSecretKey('edskSApXsFmrqD7HvgZWoGHnSso1szmg4NYjwS8Mmx2ripVt9dhFzvmqozEyBgTUD9vRAQMQv7uu7YaoWMG1sBMmcsfW1zvBU3')
        });
        // Use exact same function call as tezos.js
        const contract = await tezos.contract.at(contractAddress || 'KT1D9qehRdgVzEv1FgPNESB1DnxdekSdNbHN');
        const secretBytes = stringToBytes(secret || "123");
        const result = await contract.methodsObject.withdraw(secretBytes).send();
        const confirmation = await result.confirmation();

        res.json({
            success: true,
            network: 'Tezos',
            contractAddress: contractAddress || 'KT1D9qehRdgVzEv1FgPNESB1DnxdekSdNbHN',
            transactionHash: result.hash,
            confirmation,
            secret: secret || "123"
        });

    } catch (error) {
        console.error('Tezos withdrawal error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server with port handling
const startServer = () => {
    const PORT = process.env.PORT || 3000;

    const server = app.listen(PORT, () => {
        console.log(`Cross-chain escrow deployment API running on port ${PORT}`);
        console.log('Available endpoints:');
        console.log('  Deployment:');
        console.log('    POST /deploy/evm - Deploy EVM escrow contract');
        console.log('    POST /deploy/near - Deploy NEAR escrow contract');
        console.log('    POST /deploy/tezos - Deploy Tezos escrow contract');
        console.log('  Withdrawal:');
        console.log('    POST /withdraw/evm - Withdraw from EVM escrow');
        console.log('    POST /withdraw/near - Withdraw from NEAR escrow');
        console.log('    POST /withdraw/tezos - Withdraw from Tezos escrow');
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${PORT} is in use, trying ${PORT + 1}...`);
            process.env.PORT = PORT + 1;
            startServer();
        } else {
            console.error('Server error:', err);
        }
    });
};

startServer();

module.exports = app;
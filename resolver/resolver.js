

const fs = require('fs');
const ethers = require('ethers');
// Import the ABI of the EvmEscrowFactory contract
// taker : 0x4f334de8BC98105a0856f219ab4474a4d44A0af3

const crypto = require('crypto');
const abi = require('./abi.json'); // Assuming abi.json contains the ABI of EvmEscrowFactory
const escrowabi = require('./EvmEscrow.json'); // Assuming escrowabi.json contains the ABI of EvmEscrow


const EvmEscrowFactoryAddress = '0x49ae5957c37f993667c676dcfad35cfAa9Fbc563';
const rpc = 'https://eth-sepolia.public.blastapi.io'
const provider = new ethers.JsonRpcProvider(rpc);

const factoryContract = new ethers.Contract(EvmEscrowFactoryAddress, abi.abi, provider);
const signer = new ethers.Wallet('0x39d7e9850a20b12f20dc2476f274fe429f5c44ed54a151e93d49d91c19a1f426', provider);
const signer2 = new ethers.Wallet('0xa7788f91928410e6ebd73c01457ed9e77123719ea98bd50b23d99c3b214a9482', provider);
// struct Immutables {
//     bytes32 orderHash;
//     bytes32 hashlock; // Hash of the secret.
//     Address maker;
//     Address taker; // EVM address of the taker. 
//     Address token; 
//     uint256 amount;
//     uint256 safetyDeposit;
//     Timelocks timelocks; Timelocks is basically uint256 
// }
// Create a consistent secret and hashlock
const secretString = 'my_secret_123';
const secretBytes32 = ethers.zeroPadValue(ethers.toUtf8Bytes(secretString), 32);
const hashlock = ethers.sha256(secretBytes32); // This should match what the contract does


// First, define the timelock parameters
const escrowCreationTime = Math.floor(Date.now() / 1000); // Current Unix timestamp
const withdrawalPeriod = 0;     // Immediate withdrawal (0 seconds)
const cancellationPeriod = 3600; // 1 hour cancellation period

// Calculate timelock periods
const dstWithdrawal = withdrawalPeriod;
const dstPublicWithdrawal = withdrawalPeriod * 2; // Always 2x withdrawal period
const dstCancellation = cancellationPeriod;

// Pack timelocks into uint256
// Bit layout: [creation_time(32)][cancellation(32)][public_withdrawal(32)][withdrawal(32)]
const timelocks = (BigInt(escrowCreationTime) << 224n) |
    (BigInt(dstCancellation) << 64n) |
    (BigInt(dstPublicWithdrawal) << 32n) |
    BigInt(dstWithdrawal);

// Your corrected order object
const order = {
    orderHash: ethers.keccak256(ethers.toUtf8Bytes('unique_order_123')),
    hashlock: hashlock, // Use the properly computed hashlock
    maker: '0xdC9ab498f858c3fd7A241C1B1F326E64586B4Fce', // Convert to BigInt
    taker: '0x6F1859694601891B7ED021c3Fefd390AB776d5C0', // Convert to BigInt
    token: '0x0000000000000000000000000000000000000000', // Convert to BigInt (ETH)
    amount: ethers.parseEther('0.001'), // 0.001 ETH
    safetyDeposit: ethers.parseEther('0.0001'), // 0.0001 ETH safety deposit
    timelocks: timelocks // Properly packed timelock values
};

console.log("🔢 Timelock breakdown:");
console.log("- Escrow creation time:", escrowCreationTime);
console.log("- Withdrawal period:", dstWithdrawal, "seconds");
console.log("- Public withdrawal:", dstPublicWithdrawal, "seconds");
console.log("- Cancellation period:", dstCancellation, "seconds");
console.log("- Packed timelocks:", timelocks.toString());
console.log("- Packed timelocks (hex):", "0x" + timelocks.toString(16));


async function deployescrow() {
    try {
        // Connect the contract with signer for transactions
        const factoryWithSigner = factoryContract.connect(signer);

        // Create a deployment-ready order with proper timelock structure
        // For deployment, we use the simple timelock value and let the factory set the deployment timestamp
        const deploymentOrder = {
            ...order,
            timelocks: timelocks// Simple timelock value for deployment
        };


        console.log('Order Hash:', deploymentOrder.orderHash);
        console.log('Hashlock:', deploymentOrder.hashlock);
        console.log('Secret that produces this hashlock:', secretString);
        console.log('Maker:', deploymentOrder.maker);
        console.log('Taker:', deploymentOrder.taker);
        console.log('Token:', deploymentOrder.token);
        console.log('Amount:', ethers.formatEther(deploymentOrder.amount));
        console.log('Safety Deposit:', ethers.formatEther(deploymentOrder.safetyDeposit));
        console.log('Timelocks:', deploymentOrder.timelocks);

        // Calculate required ETH
        const isEthToken = deploymentOrder.token === '0x0000000000000000000000000000000000000000';
        const requiredForEscrow = isEthToken
            ? deploymentOrder.amount + deploymentOrder.safetyDeposit
            : deploymentOrder.safetyDeposit;

        // Get creation fee from contract
        const creationFee = await factoryContract.creationFee();
        const totalRequired = requiredForEscrow + creationFee;

        console.log('Creation fee:', ethers.formatEther(creationFee));
        console.log('Required for escrow:', ethers.formatEther(requiredForEscrow));
        console.log('Total required:', ethers.formatEther(totalRequired));

        // Check deployer balance
        const deployerBalance = await provider.getBalance(signer.address);
        console.log('Deployer balance:', ethers.formatEther(deployerBalance));

        if (deployerBalance < totalRequired) {
            throw new Error(`Insufficient balance. Need ${ethers.formatEther(totalRequired)} ETH, have ${ethers.formatEther(deployerBalance)} ETH`);
        }

        // Get predicted address before deployment
        const predictedAddress = await factoryContract.predictEscrowAddress(deploymentOrder);
        console.log('Predicted escrow address:', predictedAddress);

        // Create escrow transaction
        console.log('Sending deployment transaction...');
        const tx = await factoryWithSigner.createEscrow(deploymentOrder, {
            value: totalRequired,
            gasLimit: 500000 // Adjust gas limit as needed
        });

        console.log('Transaction sent:', tx.hash);
        console.log('Waiting for confirmation...');
        const receipt = await tx.wait();

        // Extract escrow address from events
        const escrowCreatedEvent = receipt.logs.find(log => {
            try {
                const parsed = factoryContract.interface.parseLog(log);
                return parsed.name === 'EscrowCreated';
            } catch (e) {
                return false;
            }
        });

        if (!escrowCreatedEvent) {
            throw new Error('EscrowCreated event not found in transaction logs');
        }

        const parsedEvent = factoryContract.interface.parseLog(escrowCreatedEvent);
        const escrowAddress = parsedEvent.args[0];

        console.log('=== DEPLOYMENT SUCCESSFUL ===');
        console.log('Escrow deployed at:', escrowAddress);
        console.log('Predicted address was:', predictedAddress);
        console.log('Addresses match:', predictedAddress.toLowerCase() === escrowAddress.toLowerCase());
        console.log('Transaction confirmed in block:', receipt.blockNumber);
        console.log('Gas used:', receipt.gasUsed.toString());
        console.log('View on Etherscan:', `https://sepolia.etherscan.io/tx/${tx.hash}`);

        // Verify deployment by checking escrow balance
        const escrowBalance = await provider.getBalance(escrowAddress);
        console.log('Escrow balance after deployment:', ethers.formatEther(escrowBalance), 'ETH');

        // Get the actual deployment timestamp from the block
        const deploymentBlock = await provider.getBlock(receipt.blockNumber);
        const deploymentTimestamp = deploymentBlock.timestamp;

        // Create the correct immutables structure with deployment timestamp
        const deployedImmutables = {
            ...deploymentOrder,
            timelocks: (BigInt(deploymentTimestamp) << 224n) |
                (BigInt(dstCancellation) << 64n) |
                (BigInt(dstPublicWithdrawal) << 32n) |
                BigInt(dstWithdrawal)
        };

        // Store deployment info for withdrawal including the correct immutables
        console.log('\n=== FOR WITHDRAWAL USE THESE VALUES ===');
        console.log('Escrow Address:', escrowAddress);
        console.log('Secret String:', secretString);
        console.log('Secret Bytes32:', secretBytes32);
        console.log('Block Number:', receipt.blockNumber);
        console.log('Block Timestamp:', deploymentTimestamp);
        console.log('Deployed Immutables Timelocks:', deployedImmutables.timelocks.toString());

        // Save deployment data to a file for later use
        const deploymentData = {
            escrowAddress,
            deployedImmutables,
            secretString,
            secretBytes32,
            deploymentTimestamp,
            blockNumber: receipt.blockNumber,
            transactionHash: tx.hash
        };

        fs.writeFileSync('./deployment-data.json', JSON.stringify(deploymentData, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value, 2));
        console.log('Deployment data saved to deployment-data.json');

        return {
            escrowAddress,
            transactionHash: tx.hash,
            blockNumber: receipt.blockNumber,
            deploymentTimestamp,
            predictedAddress,
            deployedImmutables
        };

    } catch (error) {
        console.error('Error deploying escrow:', error);

        // Enhanced error information
        if (error.code === 'CALL_EXCEPTION') {
            console.log('This is likely a contract revert. Common causes:');
            console.log('1. Insufficient ETH sent');
            console.log('2. Invalid timelock configuration');
            console.log('3. Contract validation failure');
        }

        throw error;
    }
}

async function getEscrowAddress() {
    try {
        // Predict the escrow address before deployment
        const predictedAddress = await factoryContract.predictEscrowAddress(order);

        console.log('Predicted escrow address:', predictedAddress);

        // Check if escrow is already deployed
        const isDeployed = await factoryContract.isDeployedEscrow(predictedAddress);

        console.log('Is escrow already deployed:', isDeployed);

        return {
            address: predictedAddress,
            isDeployed: isDeployed
        };

    } catch (error) {
        console.error('Error getting escrow address:', error);
        throw error;
    }
}

async function reconstructImmutablesForWithdrawal(escrowAddress, originalOrder) {
    try {
        // Get deployment transaction details
        // Note: You'll need to replace this with the actual deployment transaction hash or block number
        // For now, we'll try to estimate or use a provided block number

        console.log('Reconstructing immutables for withdrawal...');

        // Method 1: Try to find the deployment by looking at recent blocks
        // This is a simplified approach - in production, you'd store the deployment details

        const currentBlock = await provider.getBlock('latest');
        let deploymentTimestamp = null;

        // Try to search backwards for the deployment (limited search for demo)
        for (let blockNum = currentBlock.number; blockNum > currentBlock.number - 1000; blockNum--) {
            try {
                const block = await provider.getBlock(blockNum);
                if (block && block.transactions) {
                    for (const txHash of block.transactions) {
                        const receipt = await provider.getTransactionReceipt(txHash);
                        if (receipt && receipt.to && receipt.to.toLowerCase() === EvmEscrowFactoryAddress.toLowerCase()) {
                            // Check if this transaction created our escrow
                            const logs = receipt.logs;
                            for (const log of logs) {
                                try {
                                    const parsed = factoryContract.interface.parseLog(log);
                                    if (parsed.name === 'EscrowCreated' && parsed.args[0].toLowerCase() === escrowAddress.toLowerCase()) {
                                        deploymentTimestamp = block.timestamp;
                                        console.log('Found deployment at block:', blockNum, 'timestamp:', deploymentTimestamp);
                                        break;
                                    }
                                } catch (e) {
                                    // Not our log
                                }
                            }
                            if (deploymentTimestamp) break;
                        }
                    }
                    if (deploymentTimestamp) break;
                }
            } catch (e) {
                // Skip this block
                continue;
            }
        }

        if (!deploymentTimestamp) {
            // Fallback: estimate based on current time
            console.log('Could not find exact deployment timestamp, using estimation...');
            deploymentTimestamp = currentBlock.timestamp - 3600; // Assume deployed 1 hour ago
        }

        // Reconstruct timelocks with deployment timestamp using the correct format
        // These values should match what was used during deployment
        const withdrawalDelay = 0; // Can withdraw immediately
        const publicWithdrawalDelay = 0; // 0 seconds (2x withdrawal delay)
        const cancellationDelay = 3600; // 1 hour  
        const publicCancellationDelay = 7200; // 2 hours

        // Encode timelocks as per TimelocksLib format
        // Bit layout: [deployment_timestamp(32)][public_cancellation(32)][cancellation(32)][public_withdrawal(32)][withdrawal(32)]
        const timelocks = (BigInt(deploymentTimestamp) << BigInt(224)) |
            (BigInt(publicCancellationDelay) << BigInt(96)) |
            (BigInt(cancellationDelay) << BigInt(64)) |
            (BigInt(publicWithdrawalDelay) << BigInt(32)) |
            BigInt(withdrawalDelay);

        const reconstructedOrder = {
            ...originalOrder,
            timelocks: timelocks
        };

        console.log('Reconstructed order with deployment timestamp:', deploymentTimestamp);
        console.log('Encoded timelocks:', timelocks.toString());

        return {
            order: reconstructedOrder,
            deploymentTimestamp: deploymentTimestamp,
            withdrawalStart: deploymentTimestamp + withdrawalDelay,
            publicWithdrawalStart: deploymentTimestamp + publicWithdrawalDelay,
            cancellationStart: deploymentTimestamp + cancellationDelay,
            currentTime: currentBlock.timestamp
        };

    } catch (error) {
        console.error('Error reconstructing immutables:', error);
        throw error;
    }
}

async function withdrawEscrowtotaker() {
    try {
        // Try to load deployment data from file first
        let deploymentData = null;
        let escrowAddress = null;
        let correctImmutables = null;

        try {
            const data = fs.readFileSync('./deployment-data.json', 'utf8');
            deploymentData = JSON.parse(data, (key, value) => {
                // Convert string back to BigInt for timelocks
                if (key === 'timelocks' || key === 'amount' || key === 'safetyDeposit') {
                    return BigInt(value);
                }
                return value;
            });
            escrowAddress = deploymentData.escrowAddress;
            correctImmutables = deploymentData.deployedImmutables;
            console.log('Loaded deployment data from file');
        } catch (fileError) {
            console.log('Could not load deployment data from file, using manual address...');
            // Fallback to manual escrow address
            escrowAddress = '0x9176D9Ba84bb83b169A30Ccbc233ABB048F36Cb3'; // Replace with actual deployed escrow address
        }

        const escrowContract = new ethers.Contract(escrowAddress, escrowabi.abi, signer2);

        console.log('=== ESCROW WITHDRAWAL ===');
        console.log('Withdrawing from escrow at:', escrowAddress);
        console.log('Using secret:', secretString);

        // Use the same secret format as defined globally
        const secret = secretBytes32;

        // If we have correct immutables from deployment data, use them
        if (correctImmutables) {
            console.log('Using saved deployment immutables...');

            // Check timing
            const currentBlock = await provider.getBlock('latest');
            const deploymentTimestamp = Number(correctImmutables.timelocks >> 224n);
            const withdrawalStart = deploymentTimestamp + Number(correctImmutables.timelocks & 0xFFFFFFFFn);

            console.log('Current time:', currentBlock.timestamp);
            console.log('Withdrawal start:', withdrawalStart);
            console.log('Can withdraw now:', currentBlock.timestamp >= withdrawalStart);

            if (currentBlock.timestamp < withdrawalStart) {
                throw new Error(`Withdrawal not yet available. Current: ${currentBlock.timestamp}, Withdrawal starts: ${withdrawalStart}`);
            }

            try {
                const transaction = await escrowContract.withdraw(
                    secret,
                    correctImmutables,
                    {
                        gasLimit: 500000
                    }
                );

                console.log('Withdrawal transaction sent:', transaction.hash);
                const receipt = await transaction.wait();
                console.log('=== WITHDRAWAL SUCCESSFUL ===');
                console.log('Transaction hash:', receipt.hash);
                console.log('Block number:', receipt.blockNumber);
                console.log('View on Etherscan:', `https://sepolia.etherscan.io/tx/${receipt.hash}`);

                return {
                    transactionHash: receipt.hash,
                    blockNumber: receipt.blockNumber
                };
            } catch (immutablesError) {
                console.log('Saved immutables failed, trying to reconstruct...');
                console.log('Error was:', immutablesError.message);
            }
        }

        // Fallback: try to reconstruct immutables by finding deployment transaction
        console.log('Attempting to reconstruct immutables from blockchain...');
        const reconstructed = await reconstructImmutablesForWithdrawal(escrowAddress, order);

        console.log('Withdrawal timing check:');
        console.log('Current time:', reconstructed.currentTime);
        console.log('Withdrawal start:', reconstructed.withdrawalStart);
        console.log('Public withdrawal start:', reconstructed.publicWithdrawalStart);
        console.log('Can withdraw now:', reconstructed.currentTime >= reconstructed.withdrawalStart);

        if (reconstructed.currentTime < reconstructed.withdrawalStart) {
            throw new Error(`Withdrawal not yet available. Current: ${reconstructed.currentTime}, Withdrawal starts: ${reconstructed.withdrawalStart}`);
        }

        console.log('Attempting withdrawal with reconstructed immutables...');
        const transaction = await escrowContract.withdraw(
            secret,
            reconstructed.order,
            {
                gasLimit: 500000
            }
        );

        console.log('Withdrawal transaction sent:', transaction.hash);
        const receipt = await transaction.wait();
        console.log('=== WITHDRAWAL SUCCESSFUL ===');
        console.log('Transaction hash:', receipt.hash);
        console.log('Block number:', receipt.blockNumber);
        console.log('View on Etherscan:', `https://sepolia.etherscan.io/tx/${receipt.hash}`);

        return {
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber
        };

    } catch (error) {
        console.error('Error withdrawing from escrow:', error);

        // Additional debugging information
        console.log('\n=== DEBUG INFO ===');
        console.log('Secret used:', secret);
        console.log('Secret length:', secret.length);
        console.log('Expected hashlock in order:', order.hashlock);
        console.log('Computed hashlock from secret:', ethers.sha256(secret));

        throw error;
    }
}

// Helper function to create deployment data manually if you know the deployment details
async function createDeploymentDataFile(escrowAddress, deploymentTxHash) {
    try {
        console.log('Creating deployment data file from transaction:', deploymentTxHash);

        const receipt = await provider.getTransactionReceipt(deploymentTxHash);
        const block = await provider.getBlock(receipt.blockNumber);
        const deploymentTimestamp = block.timestamp;

        // Create the correct immutables structure with deployment timestamp
        const deployedImmutables = {
            ...order,
            timelocks: (BigInt(deploymentTimestamp) << 224n) |
                (BigInt(dstCancellation) << 64n) |
                (BigInt(dstPublicWithdrawal) << 32n) |
                BigInt(dstWithdrawal)
        };

        const deploymentData = {
            escrowAddress,
            deployedImmutables,
            secretString,
            secretBytes32,
            deploymentTimestamp,
            blockNumber: receipt.blockNumber,
            transactionHash: deploymentTxHash
        };

        fs.writeFileSync('./deployment-data.json', JSON.stringify(deploymentData, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value, 2));

        console.log('Deployment data file created successfully!');
        console.log('Escrow Address:', escrowAddress);
        console.log('Deployment Timestamp:', deploymentTimestamp);
        console.log('Block Number:', receipt.blockNumber);

        return deploymentData;
    } catch (error) {
        console.error('Error creating deployment data file:', error);
        throw error;
    }
}

async function debugEscrowState() {
    try {
        const escrowAddress = '0x726dECceB1439149A39717960146767BBfC17F52';

        // Check if this address is actually an escrow from our factory
        const isEscrow = await factoryContract.isDeployedEscrow(escrowAddress);
        console.log('Is deployed escrow from factory:', isEscrow);

        // Get the predicted address for our order to see if it matches
        const predictedAddress = await factoryContract.predictEscrowAddress(order);
        console.log('Predicted address for our order:', predictedAddress);
        console.log('Addresses match:', predictedAddress.toLowerCase() === escrowAddress.toLowerCase());

        // Check the balance of the escrow
        const balance = await provider.getBalance(escrowAddress);
        console.log('Escrow balance:', ethers.formatEther(balance), 'ETH');

        // Check current timestamp vs withdrawal periods
        const currentBlock = await provider.getBlock('latest');
        console.log('Current timestamp:', currentBlock.timestamp);
        console.log('Current time:', new Date(currentBlock.timestamp * 1000).toISOString());

        return {
            isEscrow,
            predictedAddress,
            balance: ethers.formatEther(balance),
            currentTimestamp: currentBlock.timestamp
        };
    } catch (error) {
        console.error('Error debugging escrow state:', error);
        throw error;
    }
}

// Main execution
async function main() {
    try {
        console.log('=== X3FUSION ESCROW OPERATIONS ===');
        console.log('Signer address:', signer2.address);
        console.log('Factory address:', EvmEscrowFactoryAddress);
        console.log('Network: Sepolia');

        // Uncomment the operation you want to perform:

        // 1. Deploy a new escrow
        // await deployescrow();

        // 2. Get predicted escrow address
        // await getEscrowAddress();

        // 3. Debug escrow state
        // await debugEscrowState();

        // 4. Create deployment data file manually (if you have deployment tx hash)
        // await createDeploymentDataFile('ESCROW_ADDRESS', 'DEPLOYMENT_TX_HASH');

        // 5. Withdraw from escrow (default operation)
        await withdrawEscrowtotaker();

    } catch (error) {
        console.error('Operation failed:', error);
        process.exit(1);
    }
}

// Run the main function

//deployescrow();
main();

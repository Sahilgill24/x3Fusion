# EvmEscrow Factory Deployment Guide

This guide explains how to deploy and use the EvmEscrow Factory contract for cross-chain atomic swaps with hashlock and timelock functionality.

## Contracts Overview

1. **EvmEscrow.sol** - The escrow implementation contract with hashlock/timelock functionality
2. **EvmEscrowFactory.sol** - Factory contract for deploying escrow instances
3. **DeployEvmEscrowFactory.s.sol** - Deployment script

## Prerequisites

1. **Install Foundry:**
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Install dependencies:**
   ```bash
   cd evm-contracts
   forge install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the `evm-contracts` directory:
   ```bash
   # Required
   PRIVATE_KEY=your_private_key_here
   RPC_URL=your_rpc_endpoint_here

   # Optional (with defaults)
   ACCESS_TOKEN=0x0000000000000000000000000000000000000000  # No access token requirement
   OWNER=  # Defaults to deployer address
   RESCUE_DELAY=86400  # 24 hours in seconds
   CREATION_FEE=1000000000000000  # 0.001 ETH in wei
   TREASURY=  # Defaults to deployer address
   ETHERSCAN_API_KEY=your_etherscan_api_key  # For verification
   ```

## Deployment Steps

### 1. Compile Contracts

```bash
forge build
```

### 2. Deploy to Testnet (Recommended first)

```bash
# Deploy to Sepolia testnet
forge script script/DeployEvmEscrowFactory.s.sol:DeployEvmEscrowFactory \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

### 3. Deploy to Mainnet

```bash
# Deploy to Ethereum mainnet
forge script script/DeployEvmEscrowFactory.s.sol:DeployEvmEscrowFactory \
  --rpc-url $MAINNET_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

### 4. Alternative: Direct Deployment with Custom Parameters

```bash
forge create --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --constructor-args \
  "0x0000000000000000000000000000000000000000" \
  "0xYourOwnerAddress" \
  86400 \
  "1000000000000000" \
  "0xYourTreasuryAddress" \
  src/EvmEscrowFactory.sol:EvmEscrowFactory \
  --verify
```

## Usage Examples

### Creating an Escrow

After deployment, you can create escrows using the factory:

```solidity
// Example parameters for creating an escrow
IBaseEscrow.Immutables memory immutables = IBaseEscrow.Immutables({
    orderHash: keccak256("unique_order_id"),
    hashlock: keccak256(abi.encodePacked("your_secret")), 
    maker: Address.wrap(uint160(makerAddress)),
    taker: Address.wrap(uint160(takerAddress)),
    token: Address.wrap(0), // 0 for ETH, token address for ERC20
    amount: 1 ether,
    safetyDeposit: 0.1 ether,
    timelocks: createTimelocks() // Set your timelock periods
});

// Calculate required payment
uint256 totalRequired = immutables.amount + immutables.safetyDeposit + factory.creationFee();

// Create escrow
factory.createEscrow{value: totalRequired}(immutables);
```

### Withdrawing from Escrow

```solidity
// Withdraw with secret (during withdrawal period)
escrow.withdraw(
    bytes32("your_secret"), 
    immutables
);
```

### Cancelling an Escrow

```solidity
// Cancel escrow (only taker, during cancellation period)
escrow.cancel(immutables);
```

### Emergency Rescue

```solidity
// Rescue funds after rescue delay (only taker)
escrow.rescueFunds(
    address(0), // token address (0 for ETH)
    amount,
    immutables
);
```

## Contract Addresses (Update after deployment)

- **Factory Address:** `0x...` (Update after deployment)
- **Implementation Address:** `0x...` (Automatically deployed by factory)

## Key Features

### 1. Hashlock Mechanism
- Uses SHA-256 hashing (Bitcoin compatible)
- Secret must match the hashlock to withdraw

### 2. Timelock Periods
- **Withdrawal Period:** When taker can withdraw with secret
- **Public Withdrawal Period:** When anyone can withdraw with secret
- **Cancellation Period:** When taker can cancel and return funds to maker
- **Rescue Period:** Emergency fund recovery after delay

### 3. Safety Deposits
- Additional funds locked to incentivize proper behavior
- Transferred to successful withdrawer as reward

### 4. Deterministic Addresses
- Uses Create2 for predictable escrow addresses
- Enables pre-computing escrow addresses

## Gas Estimates

- Factory deployment: ~2,500,000 gas
- Escrow creation: ~200,000 gas
- Withdrawal: ~50,000 gas
- Cancellation: ~50,000 gas

## Security Considerations

1. **Test thoroughly** on testnets before mainnet deployment
2. **Verify contracts** on Etherscan after deployment
3. **Set appropriate timelock periods** for your use case
4. **Consider access token requirements** for public operations
5. **Set reasonable rescue delays** to prevent premature fund recovery

## Troubleshooting

### Common Issues

1. **Insufficient gas:** Increase gas limit for complex operations
2. **Wrong timelock periods:** Ensure periods are set correctly for your use case
3. **Insufficient ETH:** Make sure to send enough ETH for amount + safety deposit + creation fee
4. **Token approvals:** For ERC20 tokens, approve the factory before creating escrow

### Error Messages

- `InsufficientEscrowBalance`: Not enough ETH sent to factory
- `InvalidSecret`: Secret doesn't match hashlock
- `InvalidTime`: Operation called outside valid time period
- `InvalidCaller`: Caller not authorized for this operation

## Support

For issues or questions:
1. Check this documentation
2. Review the contract source code
3. Test on testnets first
4. Contact the development team

## License

MIT License - see LICENSE file for details.

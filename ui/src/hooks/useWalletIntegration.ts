import { useAccount, useBalance, useReadContract, useWriteContract } from 'wagmi'
import { parseEther, formatEther } from 'viem'

export const useWalletIntegration = () => {
    const { address, isConnected } = useAccount()
    const { writeContract } = useWriteContract()

    const { data: balance } = useBalance({
        address: address,
    })

    const getFormattedBalance = () => {
        if (!balance) return '0'
        return parseFloat(formatEther(balance.value)).toFixed(6)
    }

    const sendTransaction = async (to: string, value: string) => {
        if (!address || !isConnected) {
            throw new Error('Wallet not connected')
        }

        try {
            // This is a basic ETH transfer - you can extend this for token transfers
            return await writeContract({
                abi: [], // Add your contract ABI here
                address: to as `0x${string}`,
                functionName: 'transfer', // Adjust based on your contract
                args: [parseEther(value)],
            })
        } catch (error) {
            console.error('Transaction failed:', error)
            throw error
        }
    }

    return {
        address,
        isConnected,
        balance: getFormattedBalance(),
        sendTransaction,
    }
}

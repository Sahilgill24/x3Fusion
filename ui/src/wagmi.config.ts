import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, metaMask, safe, walletConnect } from 'wagmi/connectors'

const projectId = 'YOUR_PROJECT_ID' // Get this from WalletConnect Cloud

export const config = createConfig({
    chains: [mainnet, sepolia],
    connectors: [
        injected(),
        metaMask(),
        safe(),
        walletConnect({ projectId }),
    ],
    transports: {
        [mainnet.id]: http(),
        [sepolia.id]: http(),
    },
})

declare module 'wagmi' {
    interface Register {
        config: typeof config
    }
}

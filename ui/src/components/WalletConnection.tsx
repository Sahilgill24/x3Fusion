import { useAccount, useConnect, useDisconnect } from 'wagmi'
import './WalletConnection.css'

const WalletConnection = () => {
    const { address, isConnected } = useAccount()
    const { connect, connectors, error, isPending } = useConnect()
    const { disconnect } = useDisconnect()

    if (isConnected) {
        return (
            <div className="wallet-connected">
                <div className="wallet-info">
                    <span className="wallet-address">
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                    <button className="disconnect-button" onClick={() => disconnect()}>
                        Disconnect
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="wallet-connection">
            <div className="connectors">
                {connectors.map((connector) => (
                    <button
                        key={connector.uid}
                        onClick={() => connect({ connector })}
                        disabled={isPending}
                        className="connector-button"
                    >
                        {connector.name}
                        {isPending && ' (connecting...)'}
                    </button>
                ))}
            </div>
            {error && <div className="error-message">{error.message}</div>}
        </div>
    )
}

export default WalletConnection

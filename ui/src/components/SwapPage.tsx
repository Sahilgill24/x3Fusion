import { useState, useEffect } from 'react';
import './SwapPage.css';
import ethIcon from '../../images/eth.png';
import nearIcon from '../../images/near.jpeg';
import tezosIcon from '../../images/tezos.png';
import axios from 'axios';
import WalletConnection from './WalletConnection';
import { useWalletIntegration } from '../hooks/useWalletIntegration';

interface SwapPageProps {
    onNavigateHome: () => void;
}

// ** RESOLVER & RELAYER ** 
// The combination of the function calls in this file acts as both the resolver and the relayer. 


const API_URL = 'http://localhost:3000'

interface Token {
    symbol: string;
    name: string;
    icon: string;
}

const tokens: Token[] = [
    { symbol: 'TEZOS', name: 'Tezos', icon: tezosIcon },
    { symbol: 'ETH', name: 'Ethereum', icon: ethIcon },
    { symbol: 'NEAR', name: 'Near Protocol', icon: nearIcon },
];

const SwapPage = ({ onNavigateHome }: SwapPageProps) => {
    const { address, isConnected, balance } = useWalletIntegration();
    const [payToken, setPayToken] = useState<Token>(tokens[0]);
    const [receiveToken, setReceiveToken] = useState<Token>(tokens[1]);
    const [payAmount, setPayAmount] = useState('32');
    const [receiveAmount, setReceiveAmount] = useState('0.01259407');
    const [secret, setSecret] = useState('');
    const [evmescrowaddress, setEvmescrowaddress] = useState('');
    const [nearcontractId, setNearContractId] = useState('');
    const [tezosEscrowAddress, setTezosEscrowAddress] = useState('');
    const [destaddress, setDestAddress] = useState('');
    const [showPayDropdown, setShowPayDropdown] = useState(false);
    const [showReceiveDropdown, setShowReceiveDropdown] = useState(false);
    const [isSwapping, setIsSwapping] = useState(false);
    const [escrowdeployed, setEscrowDeployed] = useState(false);
    const [orderHash, setOrderHash] = useState('');

    const minAmountReceived = 0.01245257;

    // Dynamic exchange rate based on token pair
    const getExchangeRate = (from: string, to: string) => {
        const rates: { [key: string]: number } = {
            'ETH-NEAR': 1375,
            'ETH-TEZOS': 5000,
            'NEAR-ETH': 1 / 1375,
            'NEAR-TEZOS': 0.62,
            'TEZOS-ETH': 1 / 850,
            'TEZOS-NEAR': 1 / 0.62,
        };
        return rates[`${from}-${to}`] || 1;
    };
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            // Cast the event target to an Element
            const targetElement = event.target as Element;

            // If clicked outside of any token-selector and not on token-dropdown, close all dropdowns
            if (!targetElement.closest('.token-selector') && !targetElement.closest('.token-dropdown')) {
                setShowPayDropdown(false);
                setShowReceiveDropdown(false);
            }
        }

        // Add event listener
        document.addEventListener('mousedown', handleClickOutside);

        // Cleanup function
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Update exchange rate when tokens change
    useEffect(() => {
        if (payAmount) {
            const currentRate = getExchangeRate(payToken.symbol, receiveToken.symbol);
            const calculated = (parseFloat(payAmount) * currentRate).toFixed(8);
            setReceiveAmount(calculated);
        }
    }, [payToken, receiveToken, payAmount]);

    const handleSwapTokens = () => {
        const temp = payToken;
        setPayToken(receiveToken);
        setReceiveToken(temp);
        setPayAmount(receiveAmount);
        setReceiveAmount(payAmount);
        // Close any open dropdowns
        setShowPayDropdown(false);
        setShowReceiveDropdown(false);
    };

    const deployEvmEscrow = async (secret: string): Promise<string> => {
        const { data } = await axios.post(`${API_URL}/deploy/evm`, { secret, orderHash });
        setEvmescrowaddress(data.escrowAddress);
        return data.escrowAddress;
    };

    const deployNearEscrow = async (secret: string): Promise<string> => {
        const { data } = await axios.post(`${API_URL}/deploy/near`, {
            orderHash,
            uniqueName: 'x3fusiondemo22',
            secret,
            maker: 'trial45.testnet'
        });
        setNearContractId(data.contractName);
        return data.contractName;
    };

    const deployTezosEscrow = async (secret: String) => {
        const resp = await axios.post(`${API_URL}/deploy/tezos`, {
            secret: secret,
            orderHash,
        })

        console.log(resp.data);
        setTezosEscrowAddress(resp.data.contractAddress);

    }


    const withdrawEvmEscrow = async (escrowAddress: String, secret: String) => {
        const resp = await axios.post(`${API_URL}/withdraw/evm`, {
            escrowAddress,
            secret,
        })

        console.log(resp.data);
    }

    const withdrawNearEscrow = async (nearcontractId: String, secret: String) => {
        const resp = await axios.post(`${API_URL}/withdraw/near`, {
            contractId: nearcontractId,
            secret: secret,
        })

        console.log(resp.data);
    }

    const beginAuction = async () => {
        // This is the function to start the Auction on Near. 
        const resp = await axios.post(`${API_URL}/auction/start`, {
            maker: 'trial45.testnet',
            // Include other necessary auction parameters
        });

        console.log('Auction started succesfully')
        const result = resp.data;
        console.log('Auction started:', 'Price', result.priceInfo, 'Start Time', result.startTime, 'End Time', result.endTime);
        // Handle auction response as needed
        await delay(5000)
        const fillOrder = await axios.post(`${API_URL}/auction/fillOrder`, {
            taker: 'othercap7803.testnet'
        });

        console.log('Order filled successfully:', fillOrder.data);
        setOrderHash(fillOrder.data.filledOrderInfo.order_hash);
        console.log('Order Hash:', fillOrder.data.filledOrderInfo.order_hash);
        // You can store the order hash in state or use it as needed
    }

    const withdrawTezosEscrow = async (secret: String) => {
        const resp = await axios.post(`${API_URL}/withdraw/tezos`, {
            secret: secret,
            contractAddress: 'KT1D9qehRdgVzEv1FgPNESB1DnxdekSdNbHN',
        })

        console.log(resp.data);
    }

    // async function verifyescrowaddresses() {
    //     if (nearcontractId === '' || evmescrowaddress === '') {
    //         console.log('Escrow addresses not set');
    //         return;
    //     }
    // }


    async function EvmToNearSwap() {
        const escaddress = await deployEvmEscrow(secret);


        console.log('EVM Escrow deployed Successfully:', escaddress);
        const contractId = await deployNearEscrow(secret);
        console.log('Near Escrow deployed Successfully:', contractId);
        // 10 seconds for Near finality

        console.log('Withdrawing from Near and EVM Escrows');
        // Withdraw from Near and EVM Escrows
        //await delay(10000); // Simulate Near finality delay

        setEscrowDeployed(true);


    }

    async function withdrawlbegin() {
        await withdrawNearEscrow(nearcontractId, secret);
        //await withdrawNearEscrow(nearcontractId, secret);
        console.log('Near Escrow withdrawn Successfully');
        await withdrawEvmEscrow(evmescrowaddress, secret);
        console.log('EVM Escrow withdrawn Successfully');
    }

    async function EvmToTezosSwap() {
        console.log('Starting EVM to Tezos swap...');
        //console.log('Auction started successfully');
        // Deploy EVM Escrow
        const esc = await deployEvmEscrow(secret);
        console.log('EVM Escrow deployed Successfully:', esc);

        // Deploy Tezos Escrow
        await deployTezosEscrow(secret);
        console.log('Tezos Escrow deployed Successfully');
        setEscrowDeployed(true);
        // Wait for finality (EVM has faster finality than Tezos)

    }

    const withdrawlbegin2 = async () => {
        console.log('Waiting for finality and withdrawing from escrows...');

        await withdrawTezosEscrow(secret);
        await withdrawEvmEscrow(evmescrowaddress, secret);
        // 15 seconds for Tezos finality

        console.log('Tezos Escrow withdrawn Successfully');


        console.log('EVM Escrow withdrawn Successfully');

        console.log('EVM to Tezos swap completed successfully!');
    }

    const executeSwap = async () => {
        const fromChain = payToken.symbol;
        const toChain = receiveToken.symbol;

        console.log(`Executing swap from ${fromChain} to ${toChain}`);
        setIsSwapping(true);

        try {
            if (fromChain === 'ETH' && toChain === 'NEAR') {
                await EvmToNearSwap();
            } else if (fromChain === 'ETH' && toChain === 'TEZOS') {
                await EvmToTezosSwap();
            } else if (fromChain === 'NEAR' && toChain === 'ETH') {
                // Reverse of EVM to Near - you can implement this later
                await beginAuction()
                await EvmToNearSwap()
            } else if (fromChain === 'TEZOS' && toChain === 'ETH') {
                // Reverse of EVM to Tezos - you can implement this later
                console.log('Tezos to EVM swap - to be implemented');
            } else if (fromChain === 'TEZOS' && toChain === 'NEAR') {
                // Reverse of Near to Tezos - you can implement this later
                console.log('Tezos to Near swap - to be implemented');
            } else {
                console.error('Unsupported swap pair:', fromChain, 'to', toChain);
            }
        } catch (error) {
            console.error('Swap failed:', error);
        } finally {
            setIsSwapping(false);
        }
    };

    const executeWithdraw = async () => {
        const fromChain = payToken.symbol;
        const toChain = receiveToken.symbol;
        if (fromChain === 'ETH' && toChain === 'NEAR') {
            await withdrawlbegin();
        } else if (fromChain === 'ETH' && toChain === 'TEZOS') {
            await withdrawlbegin2();
        }
        else if (fromChain === 'NEAR' && toChain === 'ETH') {
            // Reverse of EVM to Near - you can implement this later
            await withdrawlbegin();
        }
    }
    const handlePayAmountChange = (value: string) => {
        setPayAmount(value);
        if (value) {
            const currentRate = getExchangeRate(payToken.symbol, receiveToken.symbol);
            const calculated = (parseFloat(value) * currentRate).toFixed(8);
            setReceiveAmount(calculated);
        } else {
            setReceiveAmount('');
        }
    };

    return (
        <div className="swap-page">
            <div className="swap-container">
                <div className="swap-header">
                    <button className="back-button" onClick={onNavigateHome}>
                        ←
                    </button>
                    <h1>Swap</h1>
                    <div className="header-actions">
                        <WalletConnection />
                        <button className="settings-button">⚙</button>
                    </div>
                </div>

                <div className="swap-form">
                    {/* Pay Section */}
                    <div className="swap-section pay-section">
                        <div className="section-header">
                            <span className="section-label">Pay</span>
                            <span className="balance">
                                {isConnected && payToken.symbol === 'ETH' ? balance : '49.966986'} {payToken.symbol} <span className="max-button">Max</span>
                            </span>
                        </div>
                        <div className="input-row">
                            <div
                                className={`token-selector ${showPayDropdown ? 'open' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    // Position dropdown based on the position of the token selector
                                    if (!showPayDropdown) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setTimeout(() => {
                                            const dropdown = document.querySelector('.token-dropdown') as HTMLElement;
                                            if (dropdown) {
                                                dropdown.style.left = `${rect.left}px`;
                                                dropdown.style.top = `${rect.bottom + 5}px`;
                                                dropdown.style.width = `${rect.width}px`;
                                            }
                                        }, 0);
                                    }

                                    setShowPayDropdown(!showPayDropdown);
                                    setShowReceiveDropdown(false);
                                }}
                            >
                                <div className="token-info">
                                    <img src={payToken.icon} alt={payToken.name} className={`token-icon ${payToken.symbol.toLowerCase()}`} />
                                    <span className="token-details">
                                        <span className="token-symbol">{payToken.symbol}</span>
                                        <span className="dropdown-arrow">▼</span>
                                    </span>
                                </div>
                                {showPayDropdown && (
                                    <div className="token-dropdown" style={{ position: 'fixed' }}>
                                        {tokens.filter(t => t.symbol !== receiveToken.symbol).map(token => (
                                            <div
                                                key={token.symbol}
                                                className="token-option"
                                                onMouseDown={(e) => {
                                                    // Use mousedown instead of click
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setPayToken(token);
                                                    setShowPayDropdown(false);
                                                }}
                                            >
                                                <img src={token.icon} alt={token.name} className="token-icon" />
                                                <span>{token.symbol}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="amount-section">
                                <input
                                    type="text"
                                    className="amount-input"
                                    value={payAmount}
                                    onChange={(e) => handlePayAmountChange(e.target.value)}
                                />

                            </div>
                        </div>
                    </div>

                    {/* Swap Button */}
                    <div className="swap-arrow-container">
                        <button className="swap-arrow" onClick={handleSwapTokens}>
                            ⇅
                        </button>
                    </div>

                    {/* Receive Section */}
                    <div className="swap-section receive-section">
                        <div className="section-header">
                            <span className="section-label">Receive</span>
                            <span className="balance">
                                {receiveToken.symbol}
                            </span>
                        </div>
                        <div className="input-row">
                            <div
                                className={`token-selector ${showReceiveDropdown ? 'open' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    // Position dropdown based on the position of the token selector
                                    if (!showReceiveDropdown) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setTimeout(() => {
                                            const dropdown = document.querySelector('.token-dropdown') as HTMLElement;
                                            if (dropdown) {
                                                dropdown.style.left = `${rect.left}px`;
                                                dropdown.style.top = `${rect.bottom + 5}px`;
                                                dropdown.style.width = `${rect.width}px`;
                                            }
                                        }, 0);
                                    }

                                    setShowReceiveDropdown(!showReceiveDropdown);
                                    setShowPayDropdown(false);
                                }}
                            >
                                <div className="token-info">
                                    <img src={receiveToken.icon} alt={receiveToken.name} className={`token-icon ${receiveToken.symbol.toLowerCase()}`} />
                                    <span className="token-details">
                                        <span className="token-symbol">{receiveToken.symbol}</span>
                                        <span className="dropdown-arrow">▼</span>
                                    </span>
                                </div>
                                {showReceiveDropdown && (
                                    <div className="token-dropdown" style={{ position: 'fixed' }}>
                                        {tokens.filter(t => t.symbol !== payToken.symbol).map(token => (
                                            <div
                                                key={token.symbol}
                                                className="token-option"
                                                onMouseDown={(e) => {
                                                    // Use mousedown instead of click
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setReceiveToken(token);
                                                    setShowReceiveDropdown(false);
                                                }}
                                            >
                                                <img src={token.icon} alt={token.name} className="token-icon" />
                                                <span>{token.symbol}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="amount-section">
                                <input
                                    type="text"
                                    className="amount-input"
                                    value={receiveAmount}
                                    readOnly
                                />

                            </div>
                        </div>
                    </div>

                    {/* Exchange Rate */}
                    <div className="exchange-rate">
                        1 {payToken.symbol} = {getExchangeRate(payToken.symbol, receiveToken.symbol).toFixed(6)} {receiveToken.symbol} ↻
                    </div>

                    {/* Secret Form */}
                    <div className="secret-form">
                        <div className="secret-header">
                            <span className="secret-label">Secret</span>
                            <span className="secret-description">Enter any secret for secure swap or generate randomly</span>
                        </div>
                        <div className="secret-input-container">
                            <input
                                type="text"
                                className="secret-input"
                                placeholder="Enter your secret key..."
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="dest-address-form">
                        <div className="secret-header">
                            <span className="secret-label">Destination Address</span>
                            <span className="secret-description">Enter the destination chain address for the swap</span>
                        </div>
                        <div className="secret-input-container">
                            <input
                                type="text"
                                className="secret-input"
                                placeholder="Enter destination address..."
                                value={destaddress}
                                onChange={(e) => setDestAddress(e.target.value)}
                            />
                        </div>
                        <div>
                            <div className="secret-header">
                                <span className="secret-label">Order Hash</span>

                            </div>
                            <div className="secret-input-container">
                                <input
                                    type="text"
                                    className="secret-input"
                                    placeholder="Auto generated order Hash after Auction"
                                    value={orderHash}
                                    readOnly
                                />
                            </div>
                        </div>
                    </div>


                    {/* Swap Button */}
                    <button
                        className="swap-button"
                        disabled={!secret.trim() || !destaddress.trim() || isSwapping}
                        onClick={() => executeSwap()}
                    >
                        {isSwapping
                            ? `Swapping ${payToken.symbol} → ${receiveToken.symbol}...`
                            : (secret.trim() && destaddress.trim()
                                ? `Swap ${payToken.symbol} → ${receiveToken.symbol}`
                                : 'Enter Secret and Destination Address to Continue'
                            )
                        }
                    </button>
                    <button className="swap-button" disabled={!escrowdeployed} onClick={() => executeWithdraw()}>
                        Withdraw
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SwapPage;

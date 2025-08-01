import { useState } from 'react';
import './SwapPage.css';

interface SwapPageProps {
    onNavigateHome: () => void;
}

interface Token {
    symbol: string;
    name: string;
    icon: string;
}

const tokens: Token[] = [
    { symbol: 'ETH', name: 'Ethereum', icon: '⟠' },
    { symbol: 'NEAR', name: 'Near Protocol', icon: 'Ⓝ' },
    { symbol: 'TEZOS', name: 'Tezos', icon: '𝓣' },
];

const SwapPage = ({ onNavigateHome }: SwapPageProps) => {
    const [payToken, setPayToken] = useState<Token>(tokens[0]);
    const [receiveToken, setReceiveToken] = useState<Token>(tokens[1]);
    const [payAmount, setPayAmount] = useState('32');
    const [receiveAmount, setReceiveAmount] = useState('0.01259407');
    const [secret, setSecret] = useState('');
    const [showPayDropdown, setShowPayDropdown] = useState(false);
    const [showReceiveDropdown, setShowReceiveDropdown] = useState(false);

    const exchangeRate = 0.000393; // Mock exchange rate
    const minAmountReceived = 0.01245257;

    const handleSwapTokens = () => {
        const temp = payToken;
        setPayToken(receiveToken);
        setReceiveToken(temp);
        setPayAmount(receiveAmount);
        setReceiveAmount(payAmount);
    };

    const handlePayAmountChange = (value: string) => {
        setPayAmount(value);
        if (value) {
            const calculated = (parseFloat(value) * exchangeRate).toFixed(8);
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
                    <h1>Swap & Bridge</h1>
                    <button className="settings-button">⚙</button>
                </div>

                <div className="swap-form">
                    {/* Pay Section */}
                    <div className="swap-section pay-section">
                        <div className="section-header">
                            <span className="section-label">Pay</span>
                            <span className="balance">
                                👛 49.966986 {payToken.symbol} <span className="max-button">Max</span>
                            </span>
                        </div>
                        <div className="input-row">
                            <div className="token-selector" onClick={() => setShowPayDropdown(!showPayDropdown)}>
                                <div className="token-info">
                                    <span className="token-icon eth">{payToken.icon}</span>
                                    <span className="token-details">
                                        <span className="token-symbol">{payToken.symbol}</span>
                                        <span className="dropdown-arrow">▼</span>
                                    </span>
                                </div>
                                {showPayDropdown && (
                                    <div className="token-dropdown">
                                        {tokens.filter(t => t.symbol !== receiveToken.symbol).map(token => (
                                            <div
                                                key={token.symbol}
                                                className="token-option"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPayToken(token);
                                                    setShowPayDropdown(false);
                                                }}
                                            >
                                                <span className="token-icon">{token.icon}</span>
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
                                <div className="usd-value">≈ $31.96</div>
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
                                👛 0.03239813 {receiveToken.symbol}
                            </span>
                        </div>
                        <div className="input-row">
                            <div className="token-selector" onClick={() => setShowReceiveDropdown(!showReceiveDropdown)}>
                                <div className="token-info">
                                    <span className="token-icon near">{receiveToken.icon}</span>
                                    <span className="token-details">
                                        <span className="token-symbol">{receiveToken.symbol}</span>
                                        <span className="dropdown-arrow">▼</span>
                                    </span>
                                </div>
                                {showReceiveDropdown && (
                                    <div className="token-dropdown">
                                        {tokens.filter(t => t.symbol !== payToken.symbol).map(token => (
                                            <div
                                                key={token.symbol}
                                                className="token-option"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setReceiveToken(token);
                                                    setShowReceiveDropdown(false);
                                                }}
                                            >
                                                <span className="token-icon">{token.icon}</span>
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
                                <div className="usd-value">≈ $31.99</div>
                            </div>
                        </div>
                    </div>

                    {/* Exchange Rate */}
                    <div className="exchange-rate">
                        1 {payToken.symbol} = {exchangeRate} {receiveToken.symbol} ↻
                    </div>

                    {/* Secret Form */}
                    <div className="secret-form">
                        <div className="secret-header">
                            <span className="secret-label">Secret Key �</span>
                            <span className="secret-description">Enter your secret for secure swap</span>
                        </div>
                        <div className="secret-input-container">
                            <input
                                type="password"
                                className="secret-input"
                                placeholder="Enter your secret key..."
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Min Amount Info */}
                    <div className="min-amount-info">
                        <div className="detail-row">
                            <span className="detail-label">Min. Amount Received 🛈</span>
                            <span className="detail-value">{minAmountReceived} {receiveToken.symbol}</span>
                        </div>
                    </div>

                    {/* Swap Button */}
                    <button className="swap-button" disabled={!secret.trim()}>
                        {secret.trim() ? 'Swap' : 'Enter Secret to Continue'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SwapPage;

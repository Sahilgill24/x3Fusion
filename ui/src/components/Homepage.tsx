import type { FC } from 'react';
import './Homepage.css';

interface HomepageProps {
    onNavigateToSwap: () => void;
}

const Homepage: FC<HomepageProps> = ({ onNavigateToSwap }) => {
    return (
        <div className="homepage">
            <nav className="navbar">
                <div className="nav-container">
                    <div className="nav-brand">
                        <div className="brand-icon">🔗</div>
                        <span className="brand-name">X3Fusion</span>
                    </div>
                    <div className="nav-links">
                        <a href="#features">Features</a>
                        <a href="#how-it-works">How It Works</a>
                        <a href="#chains">Supported Chains</a>
                    </div>
                    <div className="nav-actions">
                        <button className="nav-button secondary">Connect Wallet</button>
                        <button className="nav-button primary" onClick={onNavigateToSwap}>
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            <div className="homepage-container">
                <div className="hero-section">
                    <div className="hero-content">
                        <h1 className="hero-title">
                            Cross-Chain Token <span className="gradient-text">Swaps</span>
                        </h1>
                        <p className="hero-description">
                            Revolutionizing decentralized trading with seamless cross-chain swaps,
                            optimal routing, and lightning-fast execution across multiple blockchains.
                        </p>
                        <div className="hero-actions">
                            <button className="cta-primary" onClick={onNavigateToSwap}>
                                <span>Explore Marketplace</span>
                                <span className="arrow">→</span>
                            </button>
                        </div>
                    </div>

                    <div className="hero-visual">
                        <div className="swap-preview-card">
                            <div className="card-header">
                                <div className="card-title">Cross-Chain Swap</div>
                                <div className="card-id">#X3F001</div>
                            </div>
                            <div className="swap-visual">
                                <div className="token-container">
                                    <div className="token-icon eth">Ξ</div>
                                    <div className="swap-arrow">⟷</div>
                                    <div className="token-icon near">Ⓝ</div>
                                </div>
                                <div className="swap-info">
                                    <div className="swap-rate">1 ETH = 2,847 NEAR</div>
                                    <div className="swap-status">Ready to execute in real-time</div>
                                </div>
                            </div>
                            <div className="reveal-info">
                                <div className="reveal-icon">🔓</div>
                                <span>Instant execution • Low fees • Secure</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="features-section">
                    <div className="section-header">
                        <h2>Why Choose X3Fusion</h2>
                        <p>Built on 1inch Fusion+ technology for optimal cross-chain trading</p>
                    </div>

                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon">⚡</div>
                            <h3>Lightning Speed</h3>
                            <p>Execute swaps in seconds with our optimized routing algorithms</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">�</div>
                            <h3>Multi-Chain</h3>
                            <p>Support for Ethereum, Near, and Tezos with more chains coming</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🛡️</div>
                            <h3>Maximum Security</h3>
                            <p>Audited smart contracts and battle-tested infrastructure</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Homepage;

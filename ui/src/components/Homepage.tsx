import type { FC } from 'react';
import './Homepage.css';
import ethIcon from '../../images/eth.png';
import nearIcon from '../../images/near.jpeg';
import WalletConnection from './WalletConnection';

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
                        <WalletConnection />
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
                            1inch Fusion+ for  <span className="gradient-text">Near and Tezos</span>
                        </h1>
                        <p className="hero-description">
                            Extending Fusion+ technology to Near and Tezos for seamless cross-chain swaps. 
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
                                
                            </div>
                            <div className="swap-visual">
                                <div className="token-container">
                                    <img src={ethIcon} alt="Ethereum" className="token-icon eth" />
                                    <div className="swap-arrow">⟷</div>
                                    <img src={nearIcon} alt="Near Protocol" className="token-icon near" />
                                </div>
                                <div className="swap-info">
                                    <div className="swap-rate">1 ETH = 1340 NEAR</div>
                                    <div className="swap-status">Ready to execute in real-time</div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                <div className="features-section">
                    <div className="section-header">
                        <h2>Why Choose X3Fusion</h2>
                    </div>

                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon">⚡</div>
                            <h3>Dutch Auction Mechanism</h3>

                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">�</div>
                            <h3>Bi-Directional Flow for both Near and Tezos</h3>

                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🛡️</div>
                            <h3>Public API endpoints to write your own integrations</h3>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Homepage;

import { useState } from 'react';
import './App.css';
import Homepage from './components/Homepage.tsx';
import SwapPage from './components/SwapPage.tsx';

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'swap'>('home');

  return (
    <div className="app">
      {currentPage === 'home' ? (
        <Homepage onNavigateToSwap={() => setCurrentPage('swap')} />
      ) : (
        <SwapPage onNavigateHome={() => setCurrentPage('home')} />
      )}
    </div>
  );
}

export default App;

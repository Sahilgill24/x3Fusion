# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

# X3Fusion - Cross-Chain Token Swap

X3Fusion is a next-generation token swap platform that extends 1inch Fusion+ technology for seamless cross-chain swapping between Ethereum (ETH), Near Protocol (NEAR), and Tezos (TEZOS).

## Features

- **Cross-Chain Swapping**: Seamlessly swap between ETH, NEAR, and TEZOS
- **Lightning Fast**: Execute swaps in seconds with optimal routing
- **Secure & Reliable**: Built on battle-tested protocols and smart contracts
- **Modern UI**: Minimalistic, responsive design with gradient backgrounds
- **Real-time Data**: Live exchange rates and gas fee calculations
- **Slippage Control**: Configurable slippage tolerance

## Technology Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: Modern CSS with gradients and animations
- **Architecture**: Component-based with responsive design
- **Backend**: Powered by 1inch Fusion+ technology

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the local server URL shown in the terminal

### Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── Homepage.tsx        # Landing page with features
│   ├── Homepage.css        # Homepage styling
│   ├── SwapPage.tsx        # Token swap interface
│   └── SwapPage.css        # Swap page styling
├── App.tsx                 # Main application component
├── App.css                 # Global app styles
├── index.css               # Global CSS variables and base styles
└── main.tsx                # Application entry point
```

## Supported Tokens

- **ETH** (Ethereum)
- **NEAR** (Near Protocol) 
- **TEZOS** (Tezos)

## Contributing

This is a demo application showcasing cross-chain swap functionality. Feel free to extend and improve the codebase.

## License

MIT

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

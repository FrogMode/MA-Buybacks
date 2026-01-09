# $MOVE Token Buyback Tracker

A real-time dashboard for tracking $MOVE token buyback activity onchain.

## Features

- **Live Token Data**: Real-time $MOVE token price, market cap, and volume from CoinGecko/CoinMarketCap
- **Token Information Display**: Shows token logo, price, 24h change, market cap, and circulating supply
- **Real-time Statistics**: Track total buybacks, token amounts, transaction counts, and recent activity
- **Interactive Charts**: Visualize buyback trends over time with beautiful area charts
- **Transaction History**: View detailed information about recent buyback transactions
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Modern UI**: Built with Tailwind CSS and featuring a sleek dark theme

## Tech Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: Data visualization library
- **Lucide Icons**: Beautiful icon set
- **date-fns**: Date utility library

## Getting Started

### Installation

```bash
npm install
```

### Configuration

The app uses CoinGecko by default (no API key required). To use CoinMarketCap instead:

1. Get a free API key from [CoinMarketCap](https://coinmarketcap.com/api/)
2. Create a `.env.local` file:
   ```bash
   COINMARKETCAP_API_KEY=your_api_key_here
   ```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the dashboard.

### Build

Build for production:

```bash
npm run build
```

Start production server:

```bash
npm start
```

## Project Structure

```
├── app/
│   ├── layout.tsx       # Root layout with metadata
│   ├── page.tsx         # Main dashboard page
│   └── globals.css      # Global styles and Tailwind directives
├── components/
│   ├── Header.tsx       # Navigation header with token info
│   ├── TokenInfo.tsx    # Token market data display
│   ├── StatsCards.tsx   # Statistics cards component
│   ├── BuybackChart.tsx # Buyback trends chart
│   └── TransactionTable.tsx # Transaction history table
├── lib/
│   ├── tokenData.ts     # Token market data service (CoinGecko/CMC)
│   └── api.ts           # Buyback API service (placeholder)
├── types/
│   └── index.ts         # TypeScript interfaces
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Token Market Data

The application automatically fetches live $MOVE token data from:
- **CoinGecko API** (default, no API key required)
- **CoinMarketCap API** (optional, requires API key)

Data includes:
- Current price and 24h change
- Market capitalization
- Trading volume
- Circulating supply
- Token logo

Data is cached for 60 seconds and automatically revalidated.

## Buyback API Integration

The buyback tracking currently uses mock data for demonstration. To integrate with your API:

1. Create an API service file (e.g., `lib/api.ts`)
2. Replace mock data in components with API calls
3. Add loading states and error handling
4. Implement real-time updates using WebSockets or polling

### Example API Integration Points

**StatsCards.tsx**:
- Fetch overall statistics (total buybacks, tokens, transactions)

**BuybackChart.tsx**:
- Fetch historical buyback data for charting

**TransactionTable.tsx**:
- Fetch recent transaction list with pagination

## Customization

### Styling

The application uses Tailwind CSS. Customize colors and theme in:
- `tailwind.config.ts` - Tailwind configuration
- `app/globals.css` - CSS variables and global styles

### Data Structure

Update the TypeScript interfaces in components to match your API response:

```typescript
interface Transaction {
  hash: string;
  timestamp: Date;
  tokens: number;
  value: number;
  price: number;
  status: "confirmed" | "pending";
}
```

## License

MIT

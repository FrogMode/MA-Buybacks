# $MOVE Token Buyback Tracker

A real-time dashboard for tracking $MOVE token buyback activity onchain.

## Features

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
│   ├── Header.tsx       # Navigation header
│   ├── StatsCards.tsx   # Statistics cards component
│   ├── BuybackChart.tsx # Buyback trends chart
│   └── TransactionTable.tsx # Transaction history table
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## API Integration (Coming Soon)

The current implementation uses mock data for demonstration purposes. To integrate with your API:

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

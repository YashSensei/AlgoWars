# AlgoWars

A real-time 1v1 competitive programming platform where users compete head-to-head solving algorithmic problems.

![AlgoWars](https://img.shields.io/badge/AlgoWars-1v1%20Coding%20Battles-ff3344)

## Features

- **1v1 Real-time Matches** - Battle against opponents in timed coding challenges
- **Rating System** - Elo-based ranking (+5/-5 per win/loss)
- **AI-Powered Judge** - Code evaluated by Claude AI (MegaLLM)
- **Monaco Editor** - VS Code-like coding experience with syntax highlighting
- **Resizable Panels** - Customize your workspace layout
- **Live Updates** - Real-time opponent status via WebSockets

## Tech Stack

### Backend
- **Runtime**: Bun (faster than Node.js)
- **Framework**: Hono (lightweight, fast)
- **Database**: PostgreSQL + Drizzle ORM
- **Real-time**: Socket.IO
- **Auth**: JWT + bcrypt

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4
- **Editor**: Monaco Editor
- **State**: Zustand
- **UI Components**: shadcn/ui

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (v1.0+)
- [Node.js](https://nodejs.org/) (v18+)
- [Docker](https://www.docker.com/) (for PostgreSQL)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YashSensei/AlgoWars.git
   cd AlgoWars
   ```

2. **Start the database**
   ```bash
   docker compose up -d
   ```

3. **Setup backend**
   ```bash
   # Install dependencies
   bun install

   # Setup environment
   cp .env.example .env
   # Edit .env with your database URL and API keys

   # Run migrations
   bun run db:migrate

   # Ingest problems from scraped Codeforces data
   bun run db:ingest

   # Start development server
   bun run dev
   ```

4. **Setup frontend**
   ```bash
   cd frontend

   # Install dependencies
   npm install

   # Start development server
   npm run dev
   ```

5. **Open the app**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8080

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/algowars
JWT_SECRET=your-secret-key-min-16-chars
MEGALLM_API_KEY=your-megallm-api-key
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Project Structure

```
algowars/
├── src/                    # Backend source
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── db/                # Database schema
│   ├── socket/            # WebSocket handlers
│   └── lib/               # Utilities
├── frontend/              # Next.js frontend
│   ├── src/app/          # App router pages
│   ├── src/components/   # React components
│   ├── src/lib/          # API client, utilities
│   └── src/stores/       # Zustand state
└── drizzle/              # Database migrations
```

## Available Scripts

### Backend
```bash
bun run dev          # Start with hot reload
bun run build        # Build for production
bun run start        # Run production build
bun run lint         # Lint with Biome
bun run typecheck    # TypeScript check
bun run db:generate  # Generate migrations
bun run db:migrate   # Apply migrations
bun run db:ingest    # Ingest problems from scraped data
bun run db:studio    # Open Drizzle Studio
```

### Frontend
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # ESLint check
npm run typecheck    # TypeScript check
```

## Gameplay

1. **Find a Match** - Click "Find Match" to enter the queue
2. **Wait for Opponent** - Matched with players within ±100 rating
3. **Solve the Problem** - Read the problem, write your solution
4. **Submit** - Code is judged by AI for correctness
5. **Win or Learn** - First to solve wins, rating updates instantly

## Rating System

| Event | Rating Change |
|-------|---------------|
| Win | +5 |
| Loss | -5 |
| Timeout | -5 (both) |

Starting rating: **1000**

## Screenshots

The platform features a dark cyberpunk-inspired design with:
- Glass panel effects
- Animated backgrounds
- Japanese text accents
- Red accent colors

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Problems sourced from [Codeforces](https://codeforces.com/)
- AI judge powered by [Claude](https://anthropic.com/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)

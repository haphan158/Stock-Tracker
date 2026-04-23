# 📈 Stock Tracker

A modern, real-time stock tracking web application built with Next.js 15, React 19, and TypeScript. Features user authentication, real-time stock data from Yahoo Finance, portfolio management, and interactive analytics.

## ✨ Features

- 🔐 **User Authentication** - Google OAuth integration with NextAuth.js
- 📊 **Real-time Stock Data** - Live data from Yahoo Finance API
- 💼 **Portfolio Management** - Track your investments and performance
- 👀 **Watchlist** - Monitor your favorite stocks
- 📈 **Analytics Dashboard** - Performance metrics and sector allocation
- 🎨 **Modern UI** - Beautiful, responsive design with Tailwind CSS
- 🚀 **Real-time Updates** - Live data refresh and caching
- 📱 **Mobile Responsive** - Works perfectly on all devices

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, Radix UI components
- **Authentication**: NextAuth.js v4 with Google OAuth
- **Database**: PostgreSQL with Prisma ORM
- **Data Fetching**: TanStack Query (React Query v5)
- **Stock Data**: Yahoo Finance API
- **Charts**: Recharts
- **Deployment**: Docker, Docker Compose, AWS-ready

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL
- Google Cloud Console account (for OAuth)
- Docker & Docker Compose (optional)

### 1. Clone the Repository

```bash
git clone <your-github-repo-url>
cd stock-tracker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Copy the example environment file and fill in your credentials:

```bash
cp env.example .env
```

**Required Environment Variables:**

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/stock_tracker"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-generated-secret-key"

# Google OAuth (Required for authentication)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Optional: Alpha Vantage API (alternative stock data)
ALPHA_VANTAGE_API_KEY="your-api-key"

# Optional: AWS (for production deployment)
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push
```

### 5. Run the Application

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

## 🔐 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API** and **Google OAuth2 API**
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy Client ID and Client Secret to your `.env` file

## 🐳 Docker Deployment

### Local Development with Docker

```bash
# Start the entire stack (app + PostgreSQL)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Build

```bash
# Build the image
docker build -t stock-tracker .

# Run the container
docker run -p 3000:3000 --env-file .env stock-tracker
```

## 📁 Project Structure

```
stock-tracker/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── portfolio/         # Portfolio management
│   ├── watchlist/         # Watchlist management
│   └── analytics/         # Analytics dashboard
├── src/                    # Source code
│   ├── components/         # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities and services
│   └── types/             # TypeScript type definitions
├── prisma/                 # Database schema and migrations
├── public/                 # Static assets
└── docker-compose.yml      # Local development setup
```

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Database
npx prisma generate  # Generate Prisma client
npx prisma db push   # Push schema to database
npx prisma studio    # Open Prisma Studio

# Docker
docker build -t stock-tracker .                 # Build Docker image
docker run -p 3000:3000 --env-file .env stock-tracker  # Run Docker container
```

## 🌐 API Endpoints

- `GET /api/stocks` - Fetch multiple stock data
- `GET /api/stocks/search` - Search stocks by symbol/name
- `GET /api/stocks/market-summary` - Get market summary (gainers/losers)
- `GET /api/auth/[...nextauth]` - NextAuth.js authentication

## 📊 Stock Data Sources

- **Primary**: Yahoo Finance API (via `yahoo-finance2`)
- **Fallback**: Alpha Vantage API (optional)
- **Real-time**: Live market data with automatic refresh
- **Historical**: Price history and performance metrics

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### AWS

1. Build Docker image: `docker build -t stock-tracker .`
2. Push to ECR: `aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com`
3. Deploy to ECS or EC2

### Docker

```bash
# Production build
docker build -t stock-tracker:latest .

# Run with environment file
docker run -d -p 3000:3000 --env-file .env stock-tracker:latest
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: Create a GitHub issue
- **Documentation**: Check the project structure and setup guides
- **Environment**: Ensure all required environment variables are set

## 🔒 Security Notes

- **Never commit** your `.env` file to version control
- **Rotate API keys** regularly
- **Use environment variables** for all sensitive configuration
- **Enable 2FA** on your Google Cloud account
- **Review OAuth scopes** and permissions regularly

---

**Happy Trading! 📈**

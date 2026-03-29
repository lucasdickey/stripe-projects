# Quick Start Guide

Get the Stripe Projects Feedback App up and running in 5 minutes!

## Option 1: Local Development (Easiest)

### Prerequisites
- Node.js 18+
- npm
- MongoDB running locally (or Docker)
- OpenAI API key

### Steps

**1. Setup**
```bash
# Clone or navigate to project directory
cd stripe-projects-feedback-claude

# Copy environment template
cp .env.local.example .env.local

# Edit .env.local and add your keys
# OPENAI_API_KEY=sk-your-key-here
# MONGODB_URI=mongodb://localhost:27017/feedback
```

**2. Install & Run**
```bash
# Install dependencies
npm install

# Start MongoDB (if local)
# macOS: brew services start mongodb-community
# Or just skip this if using Docker approach below

# Start development server
npm run dev
```

**3. Access**
- Open http://localhost:3000
- Submit feedback
- Watch categories auto-generate
- Chat about feedback!

## Option 2: Docker (No Local Setup)

### Prerequisites
- Docker & Docker Compose
- OpenAI API key

### Steps

**1. Setup**
```bash
# Copy environment template
cp .env.local.example .env.local

# Edit .env.local - only need OPENAI_API_KEY
# MongoDB will run in Docker automatically
```

**2. Run**
```bash
# Start everything
npm run dev:docker
# Or: docker-compose up
```

**3. Access**
- Open http://localhost:3000
- MongoDB runs on port 27017 automatically
- Stop with: `Ctrl+C` then `docker-compose down`

## Option 3: Deploy with Stripe Projects (Cloud)

### Prerequisites
- Stripe CLI: `stripe projects --version`
- GitHub account
- OpenAI API key

### Steps

**1. Install Services**
```bash
# See available services
npm run stripe:catalog

# Add hosting and database
npm run stripe:add-services
# Or manually:
# stripe projects add vercel/project
# stripe projects add railway/mongo
```

**2. Pull Credentials**
```bash
# Get MongoDB URI and other credentials
npm run stripe:env-pull
```

**3. Deploy**

For **Vercel**:
```bash
# Follow Stripe Projects prompts
# App will be live at your-app.vercel.app
```

For **Railway**:
```bash
# Go to https://railway.app
# Connect GitHub repo
# Railway auto-deploys
```

## What You Can Do

### Submit Feedback
- Enter improvement ideas
- Optionally add Twitter handle for follow-up
- Tag which AI agent you were using
- Auto-categorization happens in background

### View All Feedback
- 100 items per page
- Browse chronologically
- See who submitted what
- View auto-assigned categories

### Chat About Feedback
- Ask AI questions about patterns
- "What are the most common requests?"
- "How many people mentioned performance?"
- "What's the most important feedback?"

### See Top Categories
- Auto-generated from all feedback
- Top 10 categories shown
- Example for each category
- Count and description

## Environment Variables

**Minimal Setup:**
```env
OPENAI_API_KEY=sk-proj-xxxxx
MONGODB_URI=mongodb://localhost:27017/feedback
```

**Production Setup:**
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/feedback
OPENAI_API_KEY=sk-proj-xxxxx
NEXT_PUBLIC_API_URL=https://your-app.vercel.app
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxx
```

## Troubleshooting

### "Cannot connect to MongoDB"
```bash
# Check if MongoDB is running
mongosh

# If using Docker, ensure container is up
docker-compose ps
```

### "OpenAI API key is invalid"
- Get a new key: https://platform.openai.com/api-keys
- Ensure it starts with `sk-proj-`
- Check you have credit on account

### "Port 3000 is already in use"
```bash
# Run on different port
npm run dev -- -p 3001
```

### "Summary not generating"
- First generation takes 30+ seconds
- Ensure OPENAI_API_KEY is set
- Check OpenAI API dashboard for errors
- Try submitting 2-3 feedback items first

## Next Steps

### Customize
- Edit colors in `app/globals.css`
- Modify agents in `components/FeedbackForm.tsx`
- Change categories in `app/api/summary/route.ts`

### Deploy
- See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed guides
- One-click deploy to Vercel: `npm run stripe:add-services`
- Deploy to Railway: See [DEPLOYMENT.md](DEPLOYMENT.md)

### Monitor
- View logs: `stripe projects logs`
- Check analytics: PostHog dashboard
- Monitor database: MongoDB Atlas/Railway console

### Integrate
- Add to your documentation
- Share feedback form link
- Link from Stripe Projects docs
- Integrate with GitHub discussions

## Files Overview

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main feedback page |
| `components/FeedbackForm.tsx` | Feedback submission |
| `components/FeedbackList.tsx` | Feedback display with pagination |
| `components/ChatInterface.tsx` | AI chat component |
| `components/SummarySection.tsx` | Top 10 categories |
| `app/api/feedback/` | Feedback CRUD API |
| `app/api/summary/` | Categorization API |
| `app/api/chat/` | Chat API |
| `lib/db.ts` | Database utilities |

## Architecture

```
┌─────────────────────────────────────┐
│   Next.js App (Frontend + Backend)   │
├─────────────────────────────────────┤
│                                     │
│  /                                  │
│  ├─ Feedback Form                  │
│  ├─ Summary Section                 │
│  ├─ Chat Interface                  │
│  └─ Feedback List                   │
│                                     │
├─────────────────────────────────────┤
│   API Routes                         │
├─────────────────────────────────────┤
│  /api/feedback    - CRUD feedback    │
│  /api/summary     - AI categorization│
│  /api/chat        - AI chat          │
│                                     │
├─────────────────────────────────────┤
│   External Services                  │
├─────────────────────────────────────┤
│  MongoDB          - Store feedback   │
│  OpenAI           - AI features      │
│  PostHog (opt)    - Analytics        │
│  Vercel/Railway   - Hosting          │
│                                     │
└─────────────────────────────────────┘
```

## Common Commands

```bash
# Development
npm run dev                    # Start dev server on :3000
npm run dev:docker            # Start with Docker
npm run build                  # Build for production
npm run start                  # Run production build

# Stripe Projects
npm run stripe:catalog         # View available services
npm run stripe:env-pull        # Get credentials
npm run stripe:env-push        # Update credentials
npm run stripe:add-services    # Add recommended services

# Docker
npm run docker:build           # Build Docker image
npm run docker:run             # Run Docker container

# Code Quality
npm run lint                   # Lint code
npm run type-check             # Check TypeScript types
```

## Support

Need help?

1. Check [README.md](README.md) for detailed docs
2. See [DEPLOYMENT.md](DEPLOYMENT.md) for deploy guides
3. Review code comments in `app/api/` routes
4. Check Stripe Projects docs: https://docs.stripe.com/projects

---

**Ready to go!** Open http://localhost:3000 and start collecting feedback 🚀

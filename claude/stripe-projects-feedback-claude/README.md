# Stripe Projects Feedback App

A collaborative feedback collection and chat platform for Stripe Projects improvements. This single-page application allows users to submit improvement suggestions, optionally identify which AI agent they were using, and discuss feedback together.

## Features

✨ **Core Features:**
- 📝 Submit feedback suggestions with optional Twitter handle and agent info
- 💬 AI-powered chat to discuss feedback and improvements
- 📊 Auto-generated top 10 categories using OpenAI
- 📖 View all feedback with 100 items per page pagination
- 🎯 Category-based organization and discovery
- 🔄 Real-time updates when new feedback is submitted

## Architecture

**Stack Selection (Randomly Chosen via Stripe Projects):**
- **Hosting:** Vercel (vercel/project)
- **Database:** Railway MongoDB (railway/mongo)
- **Vector/AI:** Chroma Database (chroma/database)
- **Analytics:** PostHog (posthog/analytics)
- **Frontend Framework:** Next.js 15
- **Backend:** Next.js API Routes
- **AI Integration:** OpenAI GPT-4o-mini

## Prerequisites

1. **Node.js** 18+ and npm
2. **OpenAI API Key** (for chat and summarization)
   - Get from: https://platform.openai.com/api-keys
3. **MongoDB** instance
   - Local: `mongod` running on localhost:27017
   - Cloud: MongoDB Atlas connection string
4. **Stripe CLI** (for Stripe Projects integration)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your configuration:

```env
# MongoDB - use local or Atlas
MONGODB_URI=mongodb://localhost:27017/feedback

# OpenAI API Key
OPENAI_API_KEY=sk-...

# Optional: PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=...
```

### 3. Start MongoDB (if using local)

```bash
# macOS with Homebrew
brew services start mongodb-community

# Or manually
mongod
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
stripe-projects-feedback-claude/
├── app/
│   ├── api/
│   │   ├── feedback/route.ts      # Feedback submission and retrieval
│   │   ├── summary/route.ts       # AI-powered categorization
│   │   └── chat/route.ts          # Chat interface
│   ├── globals.css                # Global styles
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Main page
├── components/
│   ├── FeedbackForm.tsx           # Feedback submission form
│   ├── FeedbackList.tsx           # Paginated feedback display
│   ├── ChatInterface.tsx          # Chat component
│   └── SummarySection.tsx         # Category summary display
├── lib/
│   └── db.ts                      # Database utilities
├── .env.local.example             # Environment template
├── package.json                   # Dependencies
├── next.config.js                 # Next.js config
└── tsconfig.json                  # TypeScript config
```

## API Endpoints

### `POST /api/feedback`
Submit new feedback

**Request:**
```json
{
  "message": "Feature request text",
  "twitterHandle": "@optional",
  "agent": "claude|cursor|codex|other"
}
```

**Response:**
```json
{
  "id": "uuid",
  "message": "Feedback submitted successfully"
}
```

### `GET /api/feedback?page=1`
Get paginated feedback (100 items per page)

**Response:**
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "pages": 2
}
```

### `GET /api/summary`
Get auto-generated category summary (cached, regenerates after 1 hour)

**Response:**
```json
{
  "categories": [
    {
      "category": "Performance Improvements",
      "description": "...",
      "count": 15,
      "examples": ["..."]
    }
  ],
  "generatedAt": "2024-01-01T..."
}
```

### `POST /api/summary`
Manually regenerate summary

### `POST /api/chat`
Chat with AI about feedback

**Request:**
```json
{
  "message": "What are the most common requests?"
}
```

**Response:**
```json
{
  "message": "Based on the feedback..."
}
```

## Building & Deployment

### Local Production Build

```bash
npm run build
npm run start
```

### Deploy to Vercel

```bash
stripe projects add vercel/project
# Follow prompts to connect your GitHub repo
```

The app will be deployed automatically on every push to main.

### Deploy to Railway

```bash
stripe projects add railway/hosting
# Follow prompts to deploy
```

## Features in Detail

### 📝 Feedback Submission
- Plain text message (required)
- Twitter handle (optional) - for follow-up contact
- Agent selection (optional) - track which AI agent was used
- Automatic categorization after submission

### 💬 AI Chat
- Ask questions about feedback patterns
- Get insights into top requests
- Contextual responses based on recent feedback
- Powered by GPT-4o-mini

### 📊 Auto Summarization
- Uses OpenAI to analyze all feedback
- Groups into top 10 categories
- Shows example feedback for each category
- Regenerates hourly or on-demand
- Updates categorization of submitted feedback

### 📖 Pagination
- 100 items per page
- Browse all feedback chronologically
- Responsive pagination controls
- Total count displayed

## Troubleshooting

### "Failed to submit feedback"
- Check MongoDB connection: `mongosh` should connect
- Verify `MONGODB_URI` in `.env.local`

### "Failed to load summary"
- Ensure `OPENAI_API_KEY` is set correctly
- Check OpenAI API quota and usage
- Initial summary may take 30+ seconds

### Chat not responding
- Verify `OPENAI_API_KEY` is set
- Check token limits and rate limits
- Monitor OpenAI usage dashboard

### Port 3000 already in use
```bash
npm run dev -- -p 3001
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key for chat/summarization |
| `NEXT_PUBLIC_API_URL` | No | Frontend API URL (default: http://localhost:3000) |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog analytics key |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | PostHog host |

## License

MIT

## Contributing

This is a feedback collection app for Stripe Projects. Feel free to fork and deploy your own instance!

# Deployment Guide

This guide covers deploying the Stripe Projects Feedback App using Stripe Projects CLI and various hosting platforms.

## Prerequisites

- Stripe CLI with Projects plugin: `stripe projects --version`
- GitHub repository with this code
- OpenAI API key
- Stripe account (for Projects)

## Quick Start with Stripe Projects

### 1. View Available Services

```bash
stripe projects catalog
```

You'll see services organized by category:
- **Hosting**: Vercel, Railway
- **Database**: MongoDB (Railway), PostgreSQL (Neon), MySQL (PlanetScale)
- **Vector/AI**: Chroma
- **Analytics**: PostHog

### 2. Add Services

The app uses randomly selected providers. Add them to your project:

```bash
# Hosting (Vercel is recommended)
stripe projects add vercel/project

# Database (Railway MongoDB)
stripe projects add railway/mongo

# Analytics (Optional)
stripe projects add posthog/analytics

# Vector Database (Optional, for future AI features)
stripe projects add chroma/database
```

### 3. Pull Environment Variables

```bash
stripe projects env --pull
```

This creates/updates `.env.local` with credentials from all connected services.

### 4. Verify Setup

```bash
cat .env.local
```

You should see variables like:
```
MONGODB_URI=mongodb+srv://...
VERCEL_TOKEN=...
POSTHOG_API_KEY=...
```

## Deployment Methods

### Method 1: Vercel (Recommended for Stripe Projects)

#### Option A: Using Stripe Projects

```bash
# If you haven't added Vercel yet
stripe projects add vercel/project

# Follow the prompts to:
# 1. Connect your GitHub account
# 2. Select or create a Vercel project
# 3. Choose which branch to deploy from
```

#### Option B: Direct Vercel Deployment

1. Push your code to GitHub
2. Go to https://vercel.com/import
3. Import the repository
4. Add environment variables:
   - `MONGODB_URI`
   - `OPENAI_API_KEY`
5. Click "Deploy"

#### Option C: Vercel CLI

```bash
npm install -g vercel
vercel
# Follow interactive prompts
```

### Method 2: Railway (Recommended for MongoDB Integration)

#### Using Stripe Projects

```bash
# Add Railway hosting and MongoDB
stripe projects add railway/hosting
stripe projects add railway/mongo
stripe projects env --pull
```

#### Manual Railway Deployment

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub"
3. Select this repository
4. Add environment variables:
   - `MONGODB_URI` (from Railway MongoDB service)
   - `OPENAI_API_KEY`
   - `NODE_ENV=production`
5. Railway will automatically detect and build the Next.js app

### Method 3: Docker Deployment

#### Local Testing with Docker Compose

```bash
# Build and run with MongoDB
docker-compose up

# In another terminal, populate with env vars
# Edit docker-compose.yml to add your OPENAI_API_KEY
```

Access at `http://localhost:3000`

#### Deploy Docker to Cloud

**To Heroku:**
```bash
heroku login
heroku create your-app-name
heroku config:set MONGODB_URI=... OPENAI_API_KEY=...
git push heroku main
```

**To AWS ECR:**
```bash
aws ecr create-repository --repository-name stripe-feedback
aws ecr get-login-password | docker login --username AWS --password-stdin [ECR-URL]
docker tag stripe-feedback:latest [ECR-URL]/stripe-feedback:latest
docker push [ECR-URL]/stripe-feedback:latest
```

## Environment Variables Setup

### Required Variables

| Variable | Source | Example |
|----------|--------|---------|
| `MONGODB_URI` | Railway/Atlas | `mongodb+srv://user:pass@host/db` |
| `OPENAI_API_KEY` | OpenAI Platform | `sk-proj-...` |

### Optional Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_API_URL` | Manual | Override API URL (default: current domain) |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog Dashboard | Analytics tracking |
| `NODE_ENV` | System | Set to `production` for deploys |

### Getting Variables

**MongoDB URI (Railway):**
```bash
# In Railway dashboard:
# 1. Select MongoDB service
# 2. Click "Variables" tab
# 3. Copy MONGODB_URI
stripe projects env --pull  # Automatic with Stripe Projects
```

**MongoDB URI (Atlas):**
```
mongodb+srv://username:password@cluster.mongodb.net/feedback_db?retryWrites=true&w=majority
```

**OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy and save it safely

## Post-Deployment Checklist

After deploying, verify:

- [ ] Health check returns 200 status
- [ ] Can submit feedback form
- [ ] Can view feedback list
- [ ] Chat endpoint works
- [ ] Summary generation (may take 30+ seconds first time)
- [ ] MongoDB is connected (check logs)
- [ ] Environment variables are set

### Monitor Logs

**Vercel:**
```bash
vercel logs
```

**Railway:**
```bash
railway logs
```

**Local Docker:**
```bash
docker-compose logs -f app
```

## Stripe Projects CLI Commands

```bash
# View your project
stripe projects list

# Check service status
stripe projects info

# Add a new service
stripe projects add <provider>/<service>

# Remove a service
stripe projects remove <provider>/<service>

# Update credentials
stripe projects env --pull
stripe projects env --push

# Deploy to connected services
stripe projects deploy
```

## Cost Considerations

**Free Tier Options:**
- **Vercel**: Free tier (12 serverless functions, 100GB bandwidth)
- **Railway**: $5/month free credit
- **MongoDB Atlas**: Free tier (512MB storage)
- **OpenAI**: API charges per token (~$0.15 per 1M input tokens)

**Paid Services (from Stripe Projects catalog):**
- PlanetScale MySQL: Starting $9/month
- Chroma Vector DB: Pricing varies
- PostHog Analytics: Starting $29/month

## Troubleshooting

### "Cannot connect to MongoDB"
```bash
# Check MONGODB_URI is correct
echo $MONGODB_URI

# Verify credentials
stripe projects env --pull

# For Railway, ensure network access is enabled
# Settings → Database → Network
```

### "OpenAI API key is invalid"
```bash
# Verify key format
echo $OPENAI_API_KEY | head -c 10

# Check API key permissions in OpenAI dashboard
# It should have "Chat completions" access
```

### "Build fails on Vercel"
```bash
# Check Node version
node --version  # Should be 18+

# Clear cache and rebuild
vercel --prod --force

# View build logs in Vercel dashboard
```

### "MongoDB Atlas connection timeout"
```bash
# Add your IP to whitelist
# Atlas Dashboard → Network Access → Add IP Address

# Or allow all IPs (not recommended for production)
# 0.0.0.0/0
```

## Advanced: Multi-Environment Deployment

### Development
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/feedback_dev
```

### Staging
```bash
NEXT_PUBLIC_API_URL=https://staging.example.com
MONGODB_URI=mongodb+srv://user:pass@staging-cluster.mongodb.net/feedback_staging
```

### Production
```bash
NEXT_PUBLIC_API_URL=https://feedback.example.com
MONGODB_URI=mongodb+srv://user:pass@prod-cluster.mongodb.net/feedback
```

Create separate Stripe Projects for each environment:
```bash
stripe projects init --name stripe-projects-feedback-staging
stripe projects add vercel/project  # Connect to staging Vercel
```

## Scaling Considerations

As traffic grows:

1. **Database**: Upgrade MongoDB tier
2. **Caching**: Enable Redis for summary caching
3. **API**: Add rate limiting with Stripe or API gateway
4. **CDN**: Use Vercel or Railway's built-in CDN
5. **Monitoring**: Enable PostHog analytics

## Rollback

### On Vercel
```bash
vercel rollback
```

### On Railway
```bash
# Via CLI (if available)
# Or via dashboard → Deployments → Select previous version
```

### Manual Rollback
```bash
git revert <commit-hash>
git push
# Redeploy
```

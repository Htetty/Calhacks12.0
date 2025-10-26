# Canvas & Gmail AI Assistant

A React + Express application that integrates with Canvas LMS and Gmail through Composio, powered by Claude AI.

## Features

- **Gmail Integration**: Read and send emails
- **Canvas Integration**: Access assignments, courses, and grades
- **AI-Powered**: Uses Claude AI for natural language processing

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000

# Anthropic API Key (required for Claude AI)
# Get this from: https://console.anthropic.com/
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Composio Configuration (required for Gmail/Canvas integration)
# Get this from: https://app.composio.dev/
COMPOSIO_API_KEY=your_composio_api_key_here
COMPOSIO_EXTERNAL_USER_ID=default_user_123

# Gmail Integration
# Configure these in your Composio dashboard
COMPOSIO_GMAIL_AUTH_CONFIG_ID=your_gmail_auth_config_id_here
COMPOSIO_LINK_CALLBACK_URL_GMAIL=http://localhost:3000/api/auth/gmail/callback

# Canvas Integration
# Get Canvas API key from your Canvas account settings
CANVAS_API_KEY=your_canvas_api_key_here
CANVAS_BASE_URL=https://your-university.instructure.com
COMPOSIO_CANVAS_AUTH_CONFIG_ID=your_canvas_auth_config_id_here
```

### 3. Get API Keys

#### Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an account and generate an API key
3. Add it to your `.env` file as `ANTHROPIC_API_KEY`

#### Composio API Key

1. Go to [Composio Dashboard](https://app.composio.dev/)
2. Create an account and get your API key
3. Add it to your `.env` file as `COMPOSIO_API_KEY`

#### Gmail Integration

1. In Composio dashboard, configure Gmail integration
2. Set up OAuth credentials
3. Add the auth config ID to your `.env` file

#### Canvas Integration

1. Go to your Canvas account settings
2. Generate an API key
3. Add your Canvas base URL and API key to `.env`

### 4. Run the Application

```bash
# Development mode (runs both client and server)
npm run dev

# Or run separately:
# Server only
npm start

# Client only
cd client && npm run dev
```

### 5. Access the Application

Open your browser to `http://localhost:3000`

## Usage

1. **Connect Services**: Click the "Connect" buttons for Gmail and Canvas
2. **Chat**: Ask questions like:
   - "What's my latest email?"
   - "Show me my Canvas assignments"
   - "What events do I have on my calendar today?"

## Troubleshooting

### "No connected account found" Error

This error occurs when environment variables are not properly configured. Make sure:

- All required API keys are set in your `.env` file
- The `.env` file is in the root directory
- You've restarted the server after adding environment variables

### Authentication Issues

- Make sure your Composio dashboard is properly configured
- Check that callback URLs match your local development setup
- Verify API keys are correct and have proper permissions

## Project Structure

```
├── client/          # React frontend
├── server/          # Express backend
│   ├── routes/      # API routes
│   ├── services/    # AI and integration services
│   └── config/      # Configuration
└── .env            # Environment variables (create this)
```

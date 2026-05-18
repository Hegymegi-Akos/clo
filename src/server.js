import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Anthropic from '@anthropic-ai/sdk';
import cookieSession from 'cookie-session';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

const app = express();
const port = Number(process.env.PORT || 3000);
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
const isProduction = process.env.NODE_ENV === 'production';
const anthropic = process.env.CLAUDE_API_KEY
  ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
  : null;

app.set('trust proxy', 1);
app.use(express.json());
app.use(
  cookieSession({
    name: 'clo.sid',
    keys: [process.env.SESSION_SECRET || 'dev-only-secret-change-me'],
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 14
  })
);
app.use(express.static(publicDir));

function getBaseUrl(req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }

  return `${req.protocol}://${req.get('host')}`;
}

function requireUser(req, res, next) {
  if (!req.session.user) {
    res.status(401).json({ error: 'Login required.' });
    return;
  }

  next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  res.json({
    authenticated: Boolean(req.session.user),
    user: req.session.user || null,
    claudeReady: Boolean(anthropic)
  });
});

app.get('/auth/github', (req, res) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    res.status(500).send('GitHub OAuth is not configured. Fill in .env first.');
    return;
  }

  const state = crypto.randomUUID();
  req.session.oauthState = state;
  const origin = getBaseUrl(req);

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', `${origin}/auth/github/callback`);
  authorizeUrl.searchParams.set('scope', 'read:user user:email');
  authorizeUrl.searchParams.set('state', state);

  res.redirect(authorizeUrl.toString());
});

app.get('/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state || state !== req.session.oauthState) {
    res.status(400).send('Invalid OAuth state. Start the login flow again.');
    return;
  }

  try {
    const origin = getBaseUrl(req);
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${origin}/auth/github/callback`,
        state
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || 'GitHub token exchange failed.');
    }

    const profileResponse = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'clo-auth-app'
      }
    });

    const profile = await profileResponse.json();

    if (!profileResponse.ok || !profile.id) {
      throw new Error('Unable to load GitHub profile.');
    }

    req.session.user = {
      id: profile.id,
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatar_url,
      profileUrl: profile.html_url
    };
    req.session.oauthState = null;

    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('GitHub login failed. Check your OAuth app settings.');
  }
});

app.post('/auth/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

app.post('/api/chat', requireUser, async (req, res) => {
  if (!anthropic) {
    res.status(500).json({
      error: 'CLAUDE_API_KEY is missing. A custom app cannot use your Claude Pro web subscription directly.'
    });
    return;
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required.' });
    return;
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const text = message.content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n');

    res.json({ reply: text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Claude request failed.' });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/*path', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at ${baseUrl}`);
});

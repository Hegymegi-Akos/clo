# CLO

Egyszeru mintaalkalmazas GitHub bejelentkezessel es Claude-hivassal.

## Mit tud

- GitHub OAuth belepes a sajat alkalmazasodhoz
- session alapu bejelentkezve maradas
- egyszeru webes felulet
- Claude API hivasa szerveroldalrol
- publikus hostra is kiteheto

## Fontos korlat

Ez a projekt nem tudja kozvetlenul hasznalni a szemelyes Claude Pro vagy Max webes elofizetest. Sajaat webapphoz Claude API kulcs kell.

## Helyi inditas

1. Masold a `.env.example` fajlt `.env` neven.
2. Hozz letre GitHub OAuth Appot itt: `https://github.com/settings/developers`
3. Helyi callback URL: `http://localhost:3000/auth/github/callback`
4. Toltsd ki ezeket a `.env` fajlban:
   - `SESSION_SECRET`
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `CLAUDE_API_KEY`
5. Telepites:

```powershell
npm install
```

6. Inditas:

```powershell
npm run dev
```

7. Nyisd meg ezt a cimet:

```text
http://localhost:3000
```

## Publikus eleres Renderrel

1. Tedd fel a projektet GitHub repositoryba.
2. Renderen hozz letre egy uj `Web Service`-t a repositorybol.
3. A Render automatikusan hasznalni tudja a `render.yaml` fajlt.
4. Add meg a kornyezeti valtozokat Renderben:
   - `NODE_ENV=production`
   - `SESSION_SECRET`
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `CLAUDE_API_KEY`
   - `BASE_URL=https://a-sajat-render-domain-ed.onrender.com`
5. A GitHub OAuth App callback URL-jet ird at a publikus cimre:

```text
https://a-sajat-render-domain-ed.onrender.com/auth/github/callback
```

6. Deploy utan a publikus URL-en mar barhonnan elered az appot.

## Megjegyzes

- A mostani session tarolas egyszeru, egy peldanyos futashoz jo.
- Ha kesobb nagyobb vagy tobb szerveres uzemet akarsz, erdemes kulon session store-ra valtani.

## Konyvtarstruktura

- `src/server.js`: Express szerver, GitHub OAuth, Claude endpoint
- `public/index.html`: egyoldalas kliensfelulet
- `render.yaml`: Render deployment konfiguracio
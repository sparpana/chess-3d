# How to Launch 2v2 Chess on Telegram

Here are the exact steps to push your code and launch it as a Telegram Mini App.

## Part 1: Push to GitHub

You already have the repository configured. Run these commands in your terminal:

```bash
git push origin main
```

If that fails because of a mismatch, use force push (be careful, this overwrites remote):
```bash
git push origin main --force
```

## Part 2: Host Your App (The Tunnel Method)

Telegram requires a secure **HTTPS** link. Since your app is running on your computer, you need a "tunnel" to expose it to the internet.

1.  **Keep your app running**:
    *   Terminal 1: `node server.js` (Backend)
    *   Terminal 2: `npm run start:dev` (Frontend)

2.  **Start a Tunnel**:
    Open a NEW terminal (PowerShell) and use `ngrok` (recommended) or `localtunnel`.

    **Option A: Using ngrok (Best)**
    *   Download ngrok from [ngrok.com](https://ngrok.com).
    *   Run: `ngrok http 8080`
    *   Copy the **HTTPS URL** it gives you (e.g., `https://1234-56-78.ngrok-free.app`).

    **Option B: Using localtunnel (No install required)**
    *   Run: `npx localtunnel --port 8080`
    *   Copy the URL (e.g., `https://shiny-cat-42.loca.lt`).
    *   *Note: Localtunnel often asks for a password (your IP) on first visit.*

## Part 3: Configure Telegram

1.  Open Telegram and search for **@BotFather**.
2.  Send the command `/newbot`.
3.  Follow the prompts:
    *   Name: `2v2 Chess 3D`
    *   Username: `Chess2v2_Test_Bot` (must end in `bot`).
4.  Once created, send `/newapp`.
5.  Select your new bot.
6.  Enter the details:
    *   **Title**: `Play 2v2 Chess`
    *   **Description**: `A 4-player turn-based chess game.`
    *   **Photo**: (Upload any square image or skip).
    *   **Web App URL**: Paste your **HTTPS Tunnel URL** from Part 2 (e.g., `https://1234-56-78.ngrok-free.app`).
    *   **Short Name**: `play`
7.  BotFather will give you a link (e.g., `t.me/Chess2v2_Test_Bot/play`).

## Part 4: Play!

Click the link BotFather gave you. Your local app should now open inside Telegram!

### Important Notes
*   **Mobile Testing**: If you use `ngrok`, it works great on mobile. If you use `localhost`, it only works on your own computer.
*   **Persistence**: If you close your terminal or stop ngrok, the link will stop working. For a permanent app, you need to deploy to a server (like Render, Heroku, or Vercel).

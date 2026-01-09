# How to Deploy to the Web (Free)

Since you want to play with friends without keeping your computer on, you should deploy to a cloud provider. **Render** is the best free option for this project because it supports Node.js and WebSockets easily.

## Step 1: Push to GitHub
Make sure your latest code is on GitHub (we just did this).

## Step 2: Sign up for Render
1.  Go to [dashboard.render.com](https://dashboard.render.com/).
2.  Sign up with your **GitHub** account.

## Step 3: Create a New Web Service
1.  Click **"New +"** and select **"Web Service"**.
2.  Connect your GitHub repository (`chess-3d`).
3.  Configure the service:
    *   **Name**: `chess-2v2-beta` (or whatever you like)
    *   **Region**: Closest to you (e.g., Frankfurt or Ohio)
    *   **Branch**: `main`
    *   **Runtime**: `Node`
    *   **Build Command**: `npm install && npm run build`
    *   **Start Command**: `npm start`
    *   **Plan**: Free

4.  Click **"Create Web Service"**.

## Step 4: Update Telegram
Once Render finishes building (it takes about 2-3 minutes), it will give you a URL (e.g., `https://chess-2v2-beta.onrender.com`).

1.  Open Telegram and go to **@BotFather**.
2.  Type `/mybots` -> Select your bot -> **Bot Settings** -> **Menu Button** -> **Configure Menu Button**.
3.  Send the new URL (e.g., `https://chess-2v2-beta.onrender.com`).
4.  (Optional) Do the same for the `/newapp` settings if you want the attachment menu to work.

## Troubleshooting
*   **"Build Failed"**: If Render complains about missing tools, it usually means it didn't install `devDependencies`.
    *   **Fix**: In Render Settings -> Environment Variables, add `NPM_CONFIG_PRODUCTION` = `false`. This forces it to install everything needed to build.
*   **"Socket Error"**: If the game loads but doesn't connect:
    *   The app is configured to auto-detect the server, so it should work automatically.

## That's it!
Your game is now live on the internet 24/7.

# Smart Patient Hydration Reminder Bottle (prototype)

## Run locally

```sh
npm install
npm start
```

Open http://localhost:3000. The server uses `PORT` when provided and otherwise listens on port 3000. By default, JSON data is stored outside the publicly served project directory in `~/.patient-hydration-bottle/data.json`. Set `DATA_DIR` to choose another writable data directory.

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/prajaktatiple/-Patient-Hydration-Bottle-reminder)

The first deployment requires signing in to Render and authorizing creation of the service. After deployment completes, open the `onrender.com` URL Render provides to launch the app directly. GitHub repository pages display source code; they do not run Node.js servers.

The `render.yaml` Blueprint configures a **Web Service** with:

- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: leave blank when this repository is the project root

Render supplies `PORT` automatically. To retain data between deploys, attach a persistent disk mounted at `/var/data` and add the environment variable `DATA_DIR=/var/data`. Without a persistent disk, locally stored data may be lost when the service restarts or redeploys.

## Prototype limitations

This prototype has no authentication or authorization; its patient and hydration API is publicly accessible when deployed. Do not use real patient or other sensitive health information. No medical diagnosis is performed.

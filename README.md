# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
cp .env.example .env
npm run dev
```

### Environment Configuration

Before running the dashboard, create a `.env` file from `.env.example`:
- `VITE_API_BASE_URL`: Base URL of the backend serving layer (default: `http://localhost:8000`).
- `VITE_ADVISORY_API_KEY`: API key required for the `/advisory/audio` voice synthesis endpoint.

> **Note**: These environment variables must be configured before the dashboard can fetch live forecasts, location resolutions, and voice advisories.


## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

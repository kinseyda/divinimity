# Divinimity

Divinimity is a digital adaptation of the abstract strategy game Divinim.

Work in progress.

## Architecture

The project is split into two main parts: a backend server and a frontend
client. The majority of the game logic is in the frontend, with the backend
used for multiplayer.

The backend is built with Node.js and Express, and is written in TypeScript.

The frontend is built with Astro and Vue, and is also written in TypeScript. It
is built and served as static files by an Nginx server in production.

## Development / Deployment

The project uses Docker for development and production.

- The `docker-compose.yml` file shows how to set up the production environment.
  On the live server this is used, pulling the images from Docker Hub instead of
  building it. A github action builds and pushes the images to ghcr.io after
  every push to main.
- The `dev-docker-compose.yml` file is used for local development, and includes
  a volume for the frontend code, so changes are reflected immediately, thanks
  also to Astro's hot-reloading.

## To-Do

- Switch to yup or some other schema validator for forms(?)
- Online multiplayer
- Mobile friendly slice tool
- Implement AI players, time limited minimax algorithm
- Scored divinim
- Animations for slicing and removed boards disappearing

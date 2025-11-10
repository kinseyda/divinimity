# Divinimity

Divinimity is a web app adaptation of the abstract strategy game Divinim.

## Architecture

The project is split into two main parts: a backend server and a frontend
client. The majority of the game logic is in the frontend, with the backend used
for facilitating multiplayer games. Additionally, there is a shared directory
containing types and utilities used by both the frontend and backend.

The backend is built with Node.js and Express, and is written in TypeScript. It
interacts with a RethinkDB database to store game state and player information
with real-time updates. The backend exposes a REST API for the frontend to
interact with.

The frontend is built with Astro and Vue, and is also written in TypeScript. In
production, the frontend is built into static files and served by an Nginx
server for performance. For visual styling, the project uses Tailwind CSS,
components from DaisyUI, and icons from Lucide. The game is rendered using the
Paper.js vector graphics library.

The backend, frontend and database are containerized with Docker. A separate
Nginx reverse proxy is used to route requests to the appropriate service (not
part of this repository).

## Development / Deployment

The project uses Docker for development and production.

- The `docker-compose.yml` file shows how to set up a production environment
  from within the repository: to build from source and then run in production
  mode. This will be equivalent to what the live server is doing.
- The `img-docker-compose.yml` file is used for the live server, pulling the
  images from Docker Hub instead of building the project.
  - Note for production deployment: A github action, `docker-publish.yml`,
    builds and pushes the images to ghcr.io after every push to main. The action
    sets the appropriate environment variables for the frontend, which are then
    used as build arguments in the dockerfile at build time, so the
    `img-docker-compose.yml` file does not set the public URLs. This means that
    all images pulled from the registry will be built with the production
    environment variables baked in, allowing for the images to be portable and
    the files to be completely static. The backend still gets the database
    connection info and public url from environment variables at runtime,
    however. If someone wanted to run their own deployment, they would need to
    build their own images with the appropriate frontend environment variables
    set.
- The `dev-docker-compose.yml` file is used for local development. It uses
  volumes to mount the source code into the containers, allowing for live
  reloading of both the backend and frontend when code is changed.

## To-Do

- Switch to yup or some other schema validator for forms(?)
- More game setup options (boards, rulesets)
- Online multiplayer
- Optimize the render function. There is a slight hitch whenever the garbage
  collector kicks in. I suspect its due to the way I create new Paper.js groups
  every frame. The amount of tiles and boards is limited, so this doesn't seem
  to affect framerate, however it would be better to reuse objects between
  frames where no turns have happened instead of creating new ones.
- Implement AI players, time limited minimax algorithm
- Scored divinim
- Animations for slicing and removed boards disappearing
- Visual options (physics, tile spacing, colors for colorblindness?)
- Mobile app with capacitor (not sure how difficult this is)

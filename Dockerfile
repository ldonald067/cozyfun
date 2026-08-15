# Standalone deploy image for the sandbox (used by Railway).
#
# The build needs both toolchains: cargo compiles the simulation to wasm32, then Vite bundles
# the app around it. They are combined in one builder stage rather than split, because the
# Vite build consumes the wasm artifact and splitting would only add a copy step.

FROM node:24-slim AS build
WORKDIR /app

# rustup rather than the rust image so the Node major stays pinned to what CI uses.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates build-essential \
  && rm -rf /var/lib/apt/lists/* \
  && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
     | sh -s -- -y --default-toolchain stable --profile minimal --target wasm32-unknown-unknown
ENV PATH="/root/.cargo/bin:${PATH}"

# Dependencies first so a source-only change reuses the cached npm layer.
COPY app/package.json app/package-lock.json ./app/
RUN npm --prefix app ci

# The sim is its own cargo crate; copying it alone keeps the cargo layer independent of app churn.
COPY sim ./sim
COPY scripts ./scripts
COPY package.json ./
RUN npm run build:sim

COPY app ./app
# Railway injects RAILWAY_GIT_COMMIT_SHA into GitHub-triggered builds, but a Dockerfile only
# sees a build variable it declares with ARG, in the stage that uses it. This is what lets
# `npm run deploy:verify` prove which commit a running deployment is, instead of inferring it
# from an asset filename. A build without it stamps "dev" rather than a wrong commit.
ARG RAILWAY_GIT_COMMIT_SHA=""
ENV COZY_COMMIT=$RAILWAY_GIT_COMMIT_SHA
# COZY_BASE is intentionally unset, and must stay unset for this image: it serves from the
# root of its own hostname, and scripts/serve-static.mjs maps request paths straight onto
# dist without stripping a prefix. A COZY_BASE build emits /<base>/assets/... references
# while the files still sit at dist/assets/..., so this server would 404 every one of them.
# Set COZY_BASE only when handing the build to someone else's server to mount under a path.
RUN npm --prefix app run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Runs as the node image's built-in unprivileged user; nothing here needs root.
USER node
COPY --from=build --chown=node:node /app/app/dist ./app/dist
COPY --from=build --chown=node:node /app/scripts/serve-static.mjs ./scripts/serve-static.mjs
EXPOSE 8080
CMD ["node", "scripts/serve-static.mjs"]

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
# COZY_BASE is intentionally unset: this image serves the app at the root of its own
# hostname. Set it only when mounting the build under a path on a larger site.
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

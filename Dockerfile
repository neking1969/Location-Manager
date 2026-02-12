# Build stage - compile React frontend
FROM node:20-alpine AS build

WORKDIR /app

# Install client dependencies and build
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy server
COPY server/src/ ./server/src/
COPY server/data/ ./server/data/
COPY --from=build /app/server/node_modules/ ./server/node_modules/

# Copy built client
COPY --from=build /app/client/build/ ./client/build/

# Create uploads and data directories
RUN mkdir -p server/uploads server/data

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

CMD ["node", "server/src/index.js"]

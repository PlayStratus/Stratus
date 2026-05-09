FROM docker.io/node:alpine

WORKDIR /app

RUN npm install -g corepack \
  && corepack enable \
  && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .
RUN pnpm install --frozen-lockfile

COPY --parents public/ src/ components.json next-env.d.ts next.config.ts \
  postcss.config.mjs tsconfig.json .

RUN pnpm build

CMD ["pnpm", "start"]

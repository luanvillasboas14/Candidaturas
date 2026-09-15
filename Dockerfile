FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/tessdata ./tessdata
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tesseract.js ./node_modules/tesseract.js
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tesseract.js-core ./node_modules/tesseract.js-core
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/wasm-feature-detect ./node_modules/wasm-feature-detect
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/zlibjs ./node_modules/zlibjs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/is-url ./node_modules/is-url
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bmp-js ./node_modules/bmp-js
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/idb-keyval ./node_modules/idb-keyval
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/regenerator-runtime ./node_modules/regenerator-runtime
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh \
  && chmod +x /app/docker-entrypoint.sh \
  && node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('/app/package.json','utf8')); p.scripts=Object.assign({}, p.scripts, {start:'HOSTNAME=0.0.0.0 node /app/server.js'}); fs.writeFileSync('/app/package.json', JSON.stringify(p,null,2));" \
  && chown nextjs:nodejs /app/docker-entrypoint.sh /app/package.json

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV LD_LIBRARY_PATH=/opt/vips/lib

# Debian libraries support baseline x86-64; Sharp's bundled libvips requires x86-64-v2.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libglib2.0-0 libexpat1 libjpeg62-turbo libpng16-16 \
    libwebp7 libwebpmux3 libwebpdemux2 libtiff6 libexif12 \
    libheif1 librsvg2-2 liblcms2-2 libimagequant0 libcgif0 \
  && rm -rf /var/lib/apt/lists/*

FROM base AS native
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential python3 pkg-config meson ninja-build curl ca-certificates xz-utils \
    libglib2.0-dev libexpat1-dev libjpeg62-turbo-dev libpng-dev \
    libwebp-dev libtiff-dev libexif-dev libheif-dev librsvg2-dev \
    liblcms2-dev libimagequant-dev libcgif-dev \
  && rm -rf /var/lib/apt/lists/*

# Compile both libvips and Sharp without newer CPU instructions, even on a newer build host.
# Keep this version aligned with Sharp's package.json config.libvips requirement.
RUN curl -fL --retry 3 \
      https://github.com/libvips/libvips/releases/download/v8.17.3/vips-8.17.3.tar.xz \
      -o /tmp/vips.tar.xz \
  && printf '%s  /tmp/vips.tar.xz\n' \
      41e9a1439cd57dcc6d4435a085e2cfe181d9da1962fa84a484f09e8b536e4b77 | sha256sum -c - \
  && mkdir /tmp/vips-source \
  && tar -xJf /tmp/vips.tar.xz --strip-components=1 -C /tmp/vips-source \
  && if [ "$(dpkg --print-architecture)" = amd64 ]; then \
       export CFLAGS='-O2 -march=x86-64' CXXFLAGS='-O2 -march=x86-64'; \
     fi \
  && meson setup /tmp/vips-build /tmp/vips-source \
      --prefix=/opt/vips --libdir=lib --buildtype=release \
      -Dhighway=disabled -Dorc=disabled -Dmodules=disabled \
      -Dintrospection=disabled -Dexamples=false \
      -Djpeg=enabled -Dpng=enabled -Dwebp=enabled -Dtiff=enabled \
      -Dheif=enabled -Dcgif=enabled -Dimagequant=enabled -Drsvg=enabled \
  && meson compile -C /tmp/vips-build -j 2 \
  && meson install -C /tmp/vips-build \
  && rm -rf /tmp/vips.tar.xz /tmp/vips-source /tmp/vips-build

FROM native AS deps
ENV PKG_CONFIG_PATH=/opt/vips/lib/pkgconfig
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN if [ "$(dpkg --print-architecture)" = amd64 ]; then \
      export CFLAGS='-O2 -march=x86-64' CXXFLAGS='-O2 -march=x86-64'; \
    fi \
  && SHARP_FORCE_GLOBAL_LIBVIPS=1 npm ci --include=optional

FROM base AS builder
COPY --from=native /opt/vips /opt/vips
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_STACK_PROJECT_ID
ARG NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_STACK_PROJECT_ID=$NEXT_PUBLIC_STACK_PROJECT_ID
ENV NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=$NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client \
  && rm -rf /var/lib/apt/lists/*

COPY docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=native /opt/vips /opt/vips
COPY --from=builder /app/public ./public
COPY --from=builder /app/supabase ./supabase
COPY --from=builder /app/tools ./tools
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Check the source-built addon and perform real image processing in the assembled runtime.
RUN node -e "const fs = require('node:fs'); const path = require('node:path'); const sharp = require('sharp'); const addon = path.join(path.dirname(require.resolve('sharp/package.json')), 'src/build/Release/sharp-' + process.platform + '-' + process.arch + '.node'); if (!fs.existsSync(addon)) throw new Error('Source-built Sharp addon missing'); sharp({create:{width:2,height:2,channels:3,background:'red'}}).resize(1,1).png().toBuffer().then(() => console.log('Source-built Sharp image processing passed')).catch(error => {console.error(error); process.exit(1);})"

# Force image rebuild when deployment config changes.
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]

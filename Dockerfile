# Use Node + Debian as base
FROM node:20-bullseye

# Install TeX Live full and some fonts/tools
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        texlive-full \
        ghostscript \
        fonts-lmodern \
        fonts-dejavu-core \
        # Puppeteer / Chromium runtime deps
        libasound2 \
        libatk1.0-0 \
        libcairo2 \
        libcups2 \
        libdrm2 \
        libxkbcommon0 \
        libxcomposite1 \
        libxrandr2 \
        libxdamage1 \
        libxfixes3 \
        libxext6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxss1 \
        libnss3 \
        libgtk-3-0 \
        && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set workdir
WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the backend (including server.js, fonts/, etc.)
COPY . .

# Use the PORT that Render sets; your server.js already reads process.env.PORT
ENV NODE_ENV=production

# (Optional) document the port; Render will still override with its own PORT
EXPOSE 10000

# Start your server
CMD ["npm", "start"]
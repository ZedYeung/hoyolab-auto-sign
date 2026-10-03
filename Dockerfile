FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6

# Set the working directory in the container
WORKDIR /usr/src/app

# The application uses Node built-ins only. Never copy mounted secrets/config.
COPY src/main-discord.cjs ./src/main-discord.cjs
COPY LICENSE ./LICENSE
USER node

# Run the script when the container launches
CMD [ "node", "src/main-discord.cjs" ]

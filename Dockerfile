# Use an official Node.js runtime as a parent image
FROM node:14

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install any needed packages specified in package.json
RUN npm install

# Bundle the source code inside the Docker image
COPY . .

# Run the script when the container launches
CMD [ "node", "src/main-discord.gs" ]

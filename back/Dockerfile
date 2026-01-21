# We are using the bun base image
FROM oven/bun:latest

# Create a directory for your application
WORKDIR /usr/src/app

# Copy bun.lockb and package.json files to your app directory
COPY package.json package-lock.json bun.lockb ./

# Install application dependencies
RUN bun install

# Copy the rest of the application to the app directory
COPY . .

# Expose the port app runs on
EXPOSE 8081

# FIXME: whats the purpose of this port?
EXPOSE 7230 

# Run the application
CMD [ "bun", "service.ts"]
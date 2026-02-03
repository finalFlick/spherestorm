FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html/dist
COPY --from=build /app/index.html /usr/share/nginx/html/
COPY --from=build /app/assets /usr/share/nginx/html/assets
COPY --from=build /app/_headers /usr/share/nginx/html/
COPY start.sh /start.sh
RUN chmod +x /start.sh
EXPOSE 80
CMD ["/start.sh"]

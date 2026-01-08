docker-compose --env-file .env up -d --build client
docker logs -f planter-client

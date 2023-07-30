
tag=$(date "+%Y%m%d-%H%M%S")
image=yeungzed/hoyolab-auto-sign:$tag
docker buildx build --platform linux/amd64,linux/arm64 -t $image --push .
# docker push $image
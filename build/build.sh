
tag=$(date "+%Y%m%d-%H%M%S")
image=yeungzed/hoyolab-auto-sign:$tag
docker build -t $image .
docker push $image
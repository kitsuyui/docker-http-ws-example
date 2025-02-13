FROM --platform=linux/amd64 alpine AS builder
ENV FRP_VERSION 0.61.1
ENV BUILD_ARCH amd64
ENV OS linux
ENV FRP_DOWNLOAD_URL https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/frp_${FRP_VERSION}_${OS}_${BUILD_ARCH}.tar.gz
RUN apk add --no-cache wget tar \
    && wget -O frp.tar.gz $FRP_DOWNLOAD_URL \
    && tar -zxvf frp.tar.gz \
    && mv frp_${FRP_VERSION}_${OS}_${BUILD_ARCH}/frpc /usr/local/bin/frpc \
    && rm -rf frp.tar.gz frp_${FRP_VERSION}_${OS}_${BUILD_ARCH} \
    && apk del wget tar

FROM builder
CMD ["frpc", "-c", "/etc/frp/frpc.toml"]

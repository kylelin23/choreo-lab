FROM public.ecr.aws/lambda/python:3.12

RUN dnf install -y tar xz

RUN curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz \
    && tar -xf /tmp/ffmpeg.tar.xz -C /tmp \
    && cp /tmp/ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ffmpeg \
    && rm -rf /tmp/ffmpeg*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY handler.py beat_sync.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.lambda_handler"]
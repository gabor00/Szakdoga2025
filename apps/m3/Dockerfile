FROM python:3.13-slim

WORKDIR /app

COPY ./requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "Main:app", "--host", "127.0.0.1", "--port", "8000"]

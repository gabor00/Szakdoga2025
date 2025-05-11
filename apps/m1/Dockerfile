FROM python:3.11-slim

WORKDIR /app

# Rendszer függőségek telepítése
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Python függőségek telepítése
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Alkalmazás fájlok másolása
COPY ./src/ .

# Környezeti változók beállítása
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SERVICE_VERSION=${SERVICE_VERSION} \
    DEPLOYMENT_SLOT=${DEPLOYMENT_SLOT}

# Port nyitása
EXPOSE 8000

# Alkalmazás futtatása
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
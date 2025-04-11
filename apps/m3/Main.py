from fastapi import FastAPI, HTTPException
import uvicorn

app = FastAPI()

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/")
def read_root():
    return {"message": "Microservice 3"}

if __name__ == '__main__':
    uvicorn.run(app, host="0.0.0.0", port=8003)
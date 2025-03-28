from fastapi import FastAPI 

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/health")
def healt_check():
    return {"status": "health"}
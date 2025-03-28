from fastapi import FastAPI 

app = FastAPI()

@app.get("/")
def read_root():
    return {"Zaaa": "Wardoo"}

@app.get("/health")
def healt_check():
    return {"status": "health"}
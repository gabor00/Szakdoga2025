## Installation 

0. Legyen Docker Desktop a gépen, fusson és Node v20
1. `git clone https://github.com/gabor00/Szakdoga2025` futtatása
2. A fő könyvtárban futtasd az `npm i` parancsot
3. a hosts fájlva fel kell venni a 127.0.0.1-re a microservice1-2-3.com-okat
4. A Dashboard mappában létre kell hozni egy .env fájlt és bele kell írni hogy `GITHUB_TOKEN = {secret_token}` (Különben nem lehet deployolni)
5. `cd docker`
6. `docker-compose up -d` futtatása
7. Az alkalmazás elérhető a http://localhost-on


## Usage

Az alap oldal a DeploymentPage oldala ahol a microservice-ek állapota látható. Illetve az oldal tetején elérhetők a microservicek oldala is.
A Release oldal felelős az elérhető release-ek listázásáért illetve a deployment is onnan indítható. 
A felugró ablakban kiválasztható a Blue-Green slot majd a checkboxok segítségével a microservice(-ek) is.
A Traffik management oldal felelős a forgalom elosztásért az egyes microservice-ek slotjai között.


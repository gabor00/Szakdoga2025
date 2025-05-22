## Installation 

0. Legyen Docker Desktop a gépen, fusson és Node v20
1. `git clone https://github.com/gabor00/Szakdoga2025` futtatása
2. A fő könyvtárban futtasd az `npm i` parancsot
3. `cd docker`
4. `docker-compose up -d` futtatása
5. Az alkalmazás elérhető a http://localhost-on


## Usage

Az alap oldal a DeploymentPage oldala ahol a microservice-ek állapota látható. Illetve az oldal tetején elérhetők a microservicek oldala is.
A Release oldal felelős az elérhető release-ek listázásáért illetve a deployment is onnan indítható. 
A felugró ablakban kiválasztható a Blue-Green slot majd a checkboxok segítségével a microservice(-ek) is.
A Traffik management oldal felelős a forgalom elosztásért az egyes microservice-ek slotjai között.


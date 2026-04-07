# My Parse Server

- `yarn install`
- `cp .env.example .env`
- `yarn start`
- `yarn now`

sudo npm install -g npm-check-updates

ncu -u

sudo npm install -g pm2

pm2 start server.js --name "My Parse Server p=1337"

rm -rf /home/ubuntu/.pm2/logs

git config credential.helper store

To drop the parseServer database:

mongosh parseServer --eval "db.dropDatabase()"

Or if you want to just clear all collections but keep the database:

mongosh parseServer --eval "db.getCollectionNames().forEach(c => db[c].drop())"

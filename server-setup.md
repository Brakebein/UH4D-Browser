# Install on Ubuntu Server

### Curl

    > apt install curl

### Apache

    > apt update
    > apt install apache2

Enable necessary modules:

    > a2enmod proxy
    > a2enmod proxy_http
    > a2enmod proxy_balancer
    > a2enmod lbmethod_byrequests

### Java 11 (OpenJDK)

    > add-apt-repository -y ppa:openjdk-r/ppa
    > apt-get update
    > apt-get install openjdk-11-jre

### Neo4j

    > wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
    > echo 'deb https://debian.neo4j.com stable 4.0' | sudo tee -a /etc/apt/sources.list.d/neo4j.list
    > apt-get update

Community Edition:

    > apt-get install neo4j=1:4.0.3

Enterprise Edition:

    > apt-get install neo4j-enterprise=1:4.0.3

[More information](https://neo4j.com/docs/operations-manual/4.0/installation/linux/debian/)

##### Neo4j APOC Procedures

    > wget https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases/download/4.0.0.6/apoc-4.0.0.6-all.jar -P /var/lib/neo4j/plugins/

[Check version compatibilities](https://github.com/neo4j-contrib/neo4j-apoc-procedures#version-compatibility-matrix)

[All releases](https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases)

##### Admin Password

Set a password for the Neo4j database instance.

    > neo4j-admin set-initial-password <password>

##### System Service

    > systemctl enable neo4j
    > systemctl {start|stop|restart} neo4j

[More information](https://neo4j.com/docs/operations-manual/current/installation/linux/systemd/)

Special configuration to suppress a warning:

    > systemctl edit neo4j

and append the following

    [Service]
    LimitNOFILE=60000

[More information](https://neo4j.com/developer/kb/number-of-open-files-on-linux/)

    > systemctl restart neo4j

### Node.js

Version 12.x

    > curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
    > apt-get install -y nodejs

[More information](https://github.com/nodesource/distributions/blob/master/README.md#debinstall)

### PM2

Production Process Manager for Node.js applications

    > npm install -g pm2

[Quick start and cheatsheet](https://pm2.keymetrics.io/docs/usage/quick-start/#cheatsheet)

To prepare pm2 for startup, run following command and follow instructions.

    > pm2 startup

[Startup script generator](https://pm2.keymetrics.io/docs/usage/startup/)

### Git

    > apt install git

### UH4D Data

Since `unzip` has problems with big zip files, we use `7z` to unpack data.

    > apt-get install p7zip p7zip-full p7zip-rar
    > 7z x -ouh4d-data uh4d-data.zip

Import database dump into Neo4j database:

    > cypher-shell -u neo4j -p <password> -d neo4j -f uh4d-all.cypher

### UH4D-Server

    > cd ~
    
    > git clone https://github.com/Brakebein/UH4D-Server.git
    
    > cd UH4D-Server
    > npm install

[UH4D-Server on GitHub](https://github.com/Brakebein/UH4D-Server)

Configure settings: Set password according to the password you set for Neo4j

    > cp config-sample.js config.js
    > vi config.js

```javascript
module.exports = {
  neo4j: {
    url: 'neo4j://localhost',
    user: 'neo4j',
    password: '<password>',
    database: 'neo4j'
  },
  paths: {
    data: '~/uh4d-data'
  }
}
```

Start and save script with pm2:

    > pm2 start server.js --name uh4d
    > pm2 save

### UH4D Browser

Clone repository:

    > cd /var/www
    
    > git clone https://github.com/Brakebein/UH4D-Browser.git

[UH4D-Browser on GitHub](https://github.com/Brakebein/UH4D-Browser)

Set up Apache configuration:

    > cd /etc/apache2/sites-available
    > cp 000-default.conf uh4d-browser.conf
    > vi uh4d-browser.conf

```
<VirtualHost *:80>

    ServerName uh4d-prototype.local

    ServerAdmin your.name@example.com
    DocumentRoot /var/www/UH4D-Browser/dist
    
    ProxyPass /api/ http://localhost:3001/api/
    ProxyPassReverse /api/ http://localhost:3001/api/
    
    ProxyPass /data/ http://localhost:3001/data/
    ProxyPassReverse /data/ http://localhost:3001/data/

</VirtualHost>
```

    > a2ensite uh4d-browser.conf
    > service apache2 reload



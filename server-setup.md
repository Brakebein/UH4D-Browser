# Install on Ubuntu Server

### Curl

    > sudo apt install curl

### Apache

    > sudo apt update
    > sudo apt install apache2

Enable necessary modules:

    > sudo a2enmod proxy
    > sudo a2enmod proxy_http
    > sudo a2enmod proxy_balancer
    > sudo a2enmod lbmethod_byrequests

### Java 11 (OpenJDK)

    > sudo add-apt-repository -y ppa:openjdk-r/ppa
    > sudo apt-get update
    > sudo apt-get install openjdk-11-jre

### Neo4j

    > wget -O - https://debian.neo4j.com/neotechnology.gpg.key | sudo apt-key add -
    > echo 'deb https://debian.neo4j.com stable 4.0' | sudo tee -a /etc/apt/sources.list.d/neo4j.list
    > sudo apt-get update

Community Edition:

    > sudo apt-get install neo4j=1:4.0.3

Enterprise Edition:

    > sudo apt-get install neo4j-enterprise=1:4.0.3

[More information](https://neo4j.com/docs/operations-manual/4.0/installation/linux/debian/)

##### Neo4j APOC Procedures

    > sudo wget https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases/download/4.0.0.6/apoc-4.0.0.6-all.jar -P /var/lib/neo4j/plugins/

[Check version compatibilities](https://github.com/neo4j-contrib/neo4j-apoc-procedures#version-compatibility-matrix)

[All releases](https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases)

##### Admin Password

Set a password for the Neo4j database instance.

    > sudo neo4j-admin set-initial-password <password>

##### System Service

    > sudo systemctl enable neo4j
    > sudo systemctl {start|stop|restart} neo4j

[More information](https://neo4j.com/docs/operations-manual/current/installation/linux/systemd/)

Special configuration to suppress a warning:

    > sudo systemctl edit neo4j

and append the following

    [Service]
    LimitNOFILE=60000

[More information](https://neo4j.com/developer/kb/number-of-open-files-on-linux/)

    > sudo systemctl restart neo4j

### Node.js

Version 12.x

    > curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
    > sudo apt-get install -y nodejs

[More information](https://github.com/nodesource/distributions/blob/master/README.md#debinstall)

### PM2

Production Process Manager for Node.js applications

    > sudo npm install -g pm2

[Quick start and cheatsheet](https://pm2.keymetrics.io/docs/usage/quick-start/#cheatsheet)

To prepare pm2 for startup, run following command and follow instructions.

    > pm2 startup

[Startup script generator](https://pm2.keymetrics.io/docs/usage/startup/)

### Git

    > sudo apt install git

### UH4D-Server

    > cd ~
    
    > git clone https://github.com/Brakebein/UH4D-Server.git
    
    > cd UH4D-Server
    > npm install

[UH4D-Server on GitHub](https://github.com/Brakebein/UH4D-Server)

Configure settings: Set password according to the password you set for Neo4j

    > cp config-sample.js config.js
    > nano config.js

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
    
    > sudo git clone https://github.com/Brakebein/UH4D-Browser.git

[UH4D-Browser on GitHub](https://github.com/Brakebein/UH4D-Browser)

Set up Apache configuration:

    > cd /etc/apache2/sites-available
    > sudo cp 000-default.conf uh4d-browser.conf
    > sudo nano uh4d-browser.conf

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

    > sudo a2ensite uh4d-browser.conf
    > service apache2 reload



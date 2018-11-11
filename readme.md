# dio.serverfy
## What is it
dio.serverfy is a little app created for using Digitalocean to create cheap but powerful game servers when - and just when - they are needed so that you never pay a higher price for the full month.
## How it works
Serverfy is made out of two parts:
- the server app built in to a digital ocean snapshot (see server-counterparts)
- the control server (this repo) which talks to the digitalocean API

The controller creates a droplet which the configured snapshot and puts the IP through to the user.
People can now play on the desired game server.
The server app meanwhile checks if the game server is still occupied. After 5 mins of 0 connections the server app sends a termination signal to the controller, who will create a new snaphot and shutdown the droplet. The old snaphot gets deleted for budget efficency.
If the user wants to start the game server again the controller will load the new snapshot.

## Installation
Clone this repo:

`git clone https://github.com/alexplayin/dio.serverfy`

Install the required dependencies:

    npm install

Create a digitalocean snapshot with the gameserver and corresponding server app of your choice. Notice that the .js file of the server app has to be started on startup. I recommend PM2 with the param `--no-autorestart`. Otherwise data could be lost.

Configure the controller server.

Run the `server.js` file:

    node server.js


## Configuration

Open the configuration file `config.json` and change the following parameters:

~~~~
{
  // Insert your digitalocean API key here
  "auth_token": "AAAA",

  // Insert name that the snaphot should be called and which one will be loaded
  "snapshot_name": "terraria",

  // Insert name of the droplet here
  "droplet_name": "terrariaserver",

  // Setup status names here,
  "message": {
    "off": "Ausgeschaltet",
    "on": "Server läuft",
    "starting": "Fährt hoch...",
    "shuttingdown": "Fährt herunter...."
  }
}

~~~~

## Server counterparts

- [Terraria Server](github.com/alexplayin/terraria-serverfy)

Feel free to expand this list !

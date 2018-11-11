var request = require('request');
var express = require('express');
var app = express();
var path = require('path');
var config = require('./config.json');

// *******************************************************************************
// IMPORTANT NOTICE: always use 'json': 'true' for request for digitalocean
//                   API wont answer otherways
// *******************************************************************************

// DIGITAL OCEAN TOKEN
let token = config.auth_token;

// IP of running server
var ip = 0;

// ID of running droplet
var runningID = 0;

// ID of current snapshot to use
var snapshotid = 0;

// ID of snapshotevent at shutoff
var waitingID = 0;

// Object to move Interval into
var timer;

// Contains status message
var status_str = config.message.off;

// True if server is shutting shutdown
var dontcheck = false;

// Start server on 3000 --> nginx prox_pass
app.listen(3000, function() {
  console.log('[CORE] Example app listening on port 3000!');
});

// SERVE START SITE
app.get('/', function(req, res) {
  res.sendFile(path.resolve(__dirname) + '/public/index.html');
});

// API End-Point for shutting down server
app.get('/shutdown', function(req, res) {
  console.log("[SHUTDOWN] Initiating shutdown");
  status_str = config.message.shuttingdown;
  // Request to digitalocean for creating a Snapshot of current droplet --> See runningID
  request({
    auth: {
      'bearer': token
    },
    headers: {
      'Content-Type': 'application/json',

    },
    body: {
      "type": "snapshot",
      "name": config.snapshot_name
    },
    uri: 'https://api.digitalocean.com/v2/droplets/' + runningID + "/actions",
    method: 'POST',
    json: true
  }, function(err, res, body) {
    // If successful

    console.log("[SHUTDOWN] Snapshot started");

    // Save ID of snapshotevent in waitingID
    waitingID = body.action.id;

    // Start checking for status of waitingID
    timer = setInterval(checkShutdown, 5000);
  });

});

// API End-Point for starting a server
app.get('/start', function(req, res) {
  res.send("[START] Starting server");
  status_str = config.message.starting;
  // Get ID of snapshot that contains game
  getSnapID();

});

// API End-Point for server status
app.get('/ip', function(req, res) {

  // Check if server is running
  if (runningID != 0) {

    // Only request to digitalocean if IP is unclear
    if (ip == 0) {
      console.log("[STATUS] IP Request sending");

      request({
        auth: {
          'bearer': token
        },
        headers: {
          'Content-Type': 'application/json',

        },
        uri: 'https://api.digitalocean.com/v2/droplets/' + runningID,
        method: 'GET',
        json: true
      }, function(error, response, body) {
        console.log("[STATUS] IP Request answered");
        // ip_address can be empty on site of digitalocean --> run in try to catch possible errors
        try {
          // If ip from API is not undefined
          ip = body.droplet.networks.v4[0].ip_address;

          var answerbody = {
            'ip': ip,
            'status': status_str
          };

          res.send(JSON.stringify(answerbody));

          // *******************************************
          // TODO: Update status page
          // *******************************************
        } catch (e) {
          // catch error of none existend IP
          console.log("[STATUS] DIO API didnt return valid IP");
        }

      });

    } else {
      var answerbody = {
        'ip': ip,
        'status': status_str
      };
      res.send(JSON.stringify(answerbody));
    }
  } else {
    var answerbody = {
      'ip': '-',
      'status': status_str
    };
    res.send(JSON.stringify(answerbody));
  }
});

// Function to check status of snapshot via digitalocean API && perform destroy action
function checkShutdown() {

  console.log("[SHUTDOWN] Checking for shutdown");

  // Request of status of action corresponding to snapshot creation
  request({
    auth: {
      'bearer': token
    },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'request'
    },
    body: {
      'type': 'snapshot',
      'name': config.snapshot_name
    },
    uri: 'https://api.digitalocean.com/v2/actions/' + waitingID,
    method: 'GET',
    json: true
  }, function(error, result, bod) {
    if (!dontcheck) {
      if (bod.action.status == "completed") {
        // Snapshot was finished
        dontcheck = true;
        console.log("[SHUTDOWN] Snapshot completed");
        console.log("[SHUTDOWN] Sending shutdown signal");

        // Stoping timer for check of status
        clearInterval(timer);

        // Send request to digitalocean to destroy droplet
        request({
          auth: {
            'bearer': token
          },
          headers: {
            'Content-Type': 'application/json',

          },
          uri: 'https://api.digitalocean.com/v2/droplets/' + runningID,
          method: 'DELETE'
        }, function(err, res, body) {
          if (res.statusCode == 204) {
            // If digitalocean API returns "SUCCESS"
            console.log("[SHUTDOWN] server shutoff");
            status_str = config.message.off;
            // reseting working variables
            runningID = 0;
            ip = 0;
            waitingID = 0;
            deleteOldSnap(snapshotid);
            snaphotid = 0;
          }
        });
      }
    }
  });
}

function getSnapID() {

  // Request list of all owned snapshots to find "terraria"
  request({
    auth: {
      'bearer': token
    },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'request'
    },
    uri: 'https://api.digitalocean.com/v2/images?page=1&per_page=20&private=true',
    method: 'GET',
    json: true
  }, function(error, result, body) {

    for (var i = 0; i < body.images.length; i++) {

      if (body.images[i].name == config.snapshot_name) {
        snapshotid = body.images[i].id;

        // Start actual Start of droplet
        // Just needed to wait for async snapshotid
        startServer();
      }
    }
  });
}

function startServer() {

  // Check if server is already running
  if (runningID == 0) {
    console.log('[START] Starting server');

    // Setup object for digitalocean
    var send_body = {
      "name": config.droplet_name,
      "region": "fra1",
      "size": "s-2vcpu-4gb",
      "image": snapshotid,
      "ssh_keys": [],
      "backups": false,
      "ipv6": false,
      "user_data": null,
      "private_networking": null,
      "volumes": null,
      "tags": []
    };

    request({
      auth: {
        'bearer': token
      },
      headers: {
        'Content-Type': 'application/json',

      },
      body: send_body,
      uri: 'https://api.digitalocean.com/v2/droplets',
      method: 'POST',
      json: true
    }, function(error, response, body) {

      // Saving ID of newly created droplet
      runningID = body.droplet.id;
      status_str = config.message.on;

    });
    console.log("[START] Starting Request Sent");
  }
}

// Deletes old savegame for cost-optimization
function deleteOldSnap(snapid) {
  console.log('[DELETE] Trying to delete old snapshot');
  request({
    auth: {
      'bearer': token
    },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'request'
    },
    uri: 'https://api.digitalocean.com/v2/snapshots/' + snapid,
    method: 'DELETE',
    json: true
  }, function(error, result, body) {

    // 204 --> Request successful but no answer body needed
    if (result.statusCode == 204) {
      console.log('[DELETE] Sucessfully deleted old snaphot');
    }

  });
}
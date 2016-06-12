var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var clients = [];

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/boot', function (req, res) {
    res.sendFile(__dirname + '/boot.html');
});

io.on('connection', function(socket){
  loggerD('connected: ' + socket.id);

  /////////////////////////////////////////////Listeners////////////////////////////////////////////
  
  socket.on('onSignIn', function(data){
      loggerD('onSignIn: ' + data.userId);
      loggerD(data.userId + ' latitude: ' + data.latitude);
      loggerD(data.userId + ' longitude: ' + data.longitude);
      loggerD(data.userId + ' role: ' + data.roleId);

      if(data.roleId == 1){ //Monitor        
        //Verify if monitor in not singedin already
        var bertholdMon = findClientByUserId(data.userId);

        if(bertholdMon ==  null){
          //Create client objects
          bertholdMon ={
              userId:data.userId,
              socketId:socket.id,
              latitude:data.latitude,
              longitude:data.longitude
          };

          //Add client to client's list
          clients.push(bertholdMon);

          //Notify to Monitor
          io.sockets.connected[bertholdMon.socketId].emit('onSignIn', bertholdMon);
        }
        else{
            loggerI('Berthold is signed in already');
        }
      }
      else if(data.roleId == 2 ){ //Agent
        //Verify if the agent in not singedin already
        var client = findClientByUserId(data.userId);

        if(client == null){
          //Create client objects
          client ={
              userId:data.userId,
              socketId:socket.id,
              latitude:data.latitude,
              longitude:data.longitude
          };

          //Add client to client's list
          clients.push(client);

          var bertholdMon = findClientByUserId('200910586');

          if(bertholdMon != null){
            //Notify to Monitor a user has singned in
            io.sockets.connected[bertholdMon.socketId].emit('onSignIn', client);
          }
          else{
            loggerI('Berthold is not connected');
          }
        }
        else{
            loggerI(data.userId + ' user is singedin already');
        }
      } 
  });
  
    socket.on('onIsUserSignedIn', function(userId){
      loggerD('onIsUserSignedIn: ' + userId);

      var client = findClientByUserId(userId);
      
      if(client == null){
        loggerI(userId + ' user is not signed in');
      }
      else {
        loggerI(userId + ' user is signed in already');
        io.sockets.connected[client.socketId].emit('onIsUserSignedIn', true);
      }
  });

  socket.on('onAlert', function(data){
      loggerD('onAlert: ' + data.userId);
      loggerD(data.userId + ' alertTypeId: ' + data.alertTypeId);
      loggerD(data.userId + ' latitude: ' + data.latitude);
      loggerD(data.userId + ' longitude: ' + data.longitude);
      //Send alert to clients arround 1 km
      for (var i = 0; i< clients.length; i++) { 
        var client = clients[i];
        var dsitance = distanceBetweenTwoPoints(data.latitude, data.longitude, client.latitude, client.longitude);
        //Verify if client is arround 1 km
        if (dsitance <= 1) {
            loggerD('Notify alert to '+ client.userId);
            io.sockets.connected[client.socketId].emit('onAlert', data);
        }
      }

      //Issue to berthold
      var bertholdMon = findClientByUserId('200910586');

      if(bertholdMon != null)
          io.sockets.connected[bertholdMon.socketId].emit('onAlert', data);
  });

  socket.on('onGetUsersConnected', function () {
      loggerD("onGetUsersConnected");

      var bertholdMon = findClientByUserId('200910586');

      if(bertholdMon != null){
          io.sockets.connected[bertholdMon.socketId].emit('onGetUsersConnected', clients);
      }
      else {
          loggerI('Berthold is not connected');
      }
  });

  socket.on('disconnect', function(){
      loggerD('client disconnected');
      var bertholdMon = findClientByUserId('200910586');

      if(bertholdMon != null){
        var client = findClientBySocketId(socket.id);

        loggerI('SignOut '+ client.userId);

        // Don't notify if the user that has dissconectd is berthold,
        // because by the moment that try out notifiying the socket is
        // disconnected already
        if(client.userId != '200910586'){
             //Issue to monitor that a user has signed out
            io.sockets.connected[bertholdMon.socketId].emit('onSingOut', client.userId);
        }

        deleteClientBySocketId(socket.id);
      }
      else{
        loggerI('Berthold is not connected');
      }
  });
});

http.listen(3000, function(){
  loggerD('listening on *:3000');

  //Clean the clients array
  clients = null;
  clients = [];
});

//////////////////////////////////////Methods/////////////////////////////////////////////////

function distanceBetweenTwoPoints(lat1, lon1, lat2, lon2) {
    //R = earth's radius (mean radius = 6,371km)  
    var R = 6371;
    var dLat = (lat2-lat1)*Math.PI/180;  
    var dLon = (lon2-lon1)*Math.PI/180;   
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +  
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *   
            Math.sin(dLon/2) * Math.sin(dLon/2);   
    var c = 2 * Math.asin(Math.sqrt(a));   
    var d = R * c; 

    return d;
}

function findClientByUserId(userId){
    for (var i = 0; i < clients.length; i++) {
      var c = clients[i];
      if (c.userId == userId) {
         return c;
      }
    }
}

function findClientBySocketId(socketId){
    for (var i = 0; i < clients.length; i++) {
      var c = clients[i];
      if (c.socketId == socketId) {
         return c;
      }
    }
}

function deleteClientBySocketId(socketId){
    for (var i = 0; i < clients.length; i++) {
      var c = clients[i];
      if (c.socketId == socketId) {
        clients.splice(i, 1);
      }
    }
}

function loggerD(msg){
  console.log(new Date().toLocaleString() + ' ' + 'DEBUG->' + msg);
}

function loggerI(msg){
  console.log(new Date().toLocaleString() + ' ' + 'INFO->' + msg);
}

function loggerE(msg){
  console.log(new Date().toLocaleString() + ' ' + 'ERROR->' + msg);
}
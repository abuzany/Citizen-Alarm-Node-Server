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
        var berthold = findClientByUserId(data.userId);

        if(berthold ==  null){
          //berthold agent object
          berthold ={
              userId:data.userId,
              socketId:socket.id,
              latitude:data.latitude,
              longitude:data.longitude
          };

          //Add client to client's list
          clients.push(berthold);

          //Notify to Monitor
          io.sockets.connected[berthold.socketId].emit('onBertholdSignedIn', berthold);
        }
        else{
            loggerI('Berthold is signed in already');
        }
      }
      else if(data.roleId == 2 ){ //Agent
        //Verify if the agent in not singedin already
        var agent = findClientByUserId(data.userId);

        if(agent == null){
          //Create agent objec
          agent ={
              userId:data.userId,
              socketId:socket.id,
              latitude:data.latitude,
              longitude:data.longitude
          };

          //Add client to client's list
          clients.push(agent);

          var berthold = findClientByUserId('200910586');

          if(berthold != null){
            //Notify to Monitor a user has singned in
            io.sockets.connected[berthold.socketId].emit('onAgentSignedIn', agent);
            //Notify to Agent the login status
            io.sockets.connected[agent.socketId].emit('onSignedIn', 200);
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

    var agent = findClientByUserId(userId);
    
    if(agent == null){
      loggerI(userId + ' user is not signed in');
    }
    else {
      loggerI(userId + ' user is signed in already');
      io.sockets.connected[agent.socketId].emit('onIsUserSignedIn', true);
    }
});

  socket.on('onAlert', function(alert){    
      loggerD('onAlert: ' + alert.userId);
      loggerD(alert.userId + ' alertTypeId: ' + alert.alertTypeId);
      loggerD(alert.userId + ' latitude: ' + alert.latitude);
      loggerD(alert.userId + ' longitude: ' + alert.longitude);
      
      loggerI('Notifying to agents arround 1 km');      
      //Send alert to clients arround 1 km
      for (var i = 0; i< clients.length; i++) { 
        var agent = clients[i];
        var dsitance = distanceBetweenTwoPoints(alert.latitude, alert.longitude, agent.latitude, agent.longitude);
        //Verify if agent is arround 1 km, is not the same agent which emitted the alert and It's not Berthold
        if ((dsitance) <= 1 && (agent.userId != alert.userId && (agent.userId != '200910586'))) {
            loggerD('Notifying alert to '+ agent.userId);
            io.sockets.connected[agent.socketId].emit('onAlert', alert);
        }
      }

      loggerI('Notifying the alert to Berthold');

      var bertholdMon = findClientByUserId('200910586');

      if(bertholdMon != null){
          io.sockets.connected[bertholdMon.socketId].emit('onAlert', alert);
      }
      else{
        loggerI('Berthold is not connected');
      }
  });

  socket.on('onGetUsersConnected', function () {
      loggerD("onGetUsersConnected");

      var bertholdMon = findClientByUserId('200910586');

      if(bertholdMon != null)
          io.sockets.connected[bertholdMon.socketId].emit('onGetUsersConnected', clients);
      else
        loggerI('Berthold is not connected');
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
      }
      else
        loggerI('Berthold is not connected');

      deleteClientBySocketId(socket.id);          
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
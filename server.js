var express = require("express"),
	app = express(),
	mongoose = require('mongoose'),
	player = require('./server/model/player_class'),
	path = require('path'),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	db = require('./server/database');

app.use(express.static(path.join(__dirname, 'client')));

// uncomment following line to see the twenty random questions in console
// db.getQuestions(function(questions){
// 	console.log(questions[0].options);
// });

var port = process.env.PORT || 5000;
server.listen(port, function() {
    console.log("Listening on " + port);


});


/* serves main page */
app.get("/", function(req, res) {
	var filepath = path.resolve('client/views/index.html');
    res.sendfile(filepath);
});

var wait_queue = [];
var match_pool = new Object();
var users = [];
var matchCounter = 0;
var sockets_list = new Object();

io.sockets.on('connection', function(socket){
	socket.on('new_player', function(req, callback){
		var player = require('./server/model/player_class'); 
		var match = require('./server/model/match_class');

		console.log(req.id);
		console.log(req.username);
		console.log(req.name);
		var new_player = new player.Player(req.id, req.username, req.name);
		console.log(new_player);
		// db.updatePlayerInfo(new_player);

		var data;
		if(users.indexOf(new_player.id) == -1){ ////// MULTIPLE GAMES ////// MULTIPLE GAMES ////// MULTIPLE GAMES
			var suc = false;
			console.log(users.indexOf(new_player.id));
			users.push(new_player.id);
			console.log(new_player.id);
			socket.player = new_player;
			sockets_list[new_player.id] = socket;

			socket.join(match);
			if((wait_queue.length)%2 == 0){
				suc = true;
				wait_queue.push(new_player);
				data = {position: wait_queue.length};
				sockets_list[new_player.id].status = 'wait';
				console.log('wait_queue');
			} else {
				var waiting_player = wait_queue.shift();
//				if (waiting_player.id != new_player.id) {
					suc = true;
					db.getQuestions(function(questions){ //questions format [{id:id, img:url, options:[option1, option2, option3, option4] X 5]
						match_pool[matchCounter] = new match.Match(waiting_player, new_player, questions, function(){
							delete match_pool[match];
					 	});	
						// console.log(match_pool[matchCounter].qs[0].options); //test
					});

					data = {match_id: match};

					sockets_list[new_player.id].match_id = match;
					sockets_list[waiting_player.id].match_id = match;

					// socket.broadcast.to(match).emit('new_player_result', { challenger: waiting_player.name }, function(data){ });
					sockets_list[new_player.id].emit('new_player_result', { challenger: waiting_player.name }, function(data){ });
					sockets_list[waiting_player.id].emit('new_player_result',  { challenger: new_player.name }, function(data){ });

					//match_pool.push(new Match(old_player, player));
					sockets_list[new_player.id].status = 'play';
					sockets_list[waiting_player.id].status = 'play';

					console.log('game_started');
					matchCounter++; // increment match					
//				}
			}
//			if (suc == true) {
				var returnObj	 = {success: true, status: sockets_list[new_player.id].status, data:data};
				console.log(returnObj);
				callback(returnObj);
//			}
//			else {
//				callback({success: false, status:"You can't start two sessions at once."});						
//			}
		} else {
			callback({success: false, status:"You can't start two sessions at once."});
		}
	});
	
	socket.on('disconnect', function () {
		if(!socket.player){
			console.log('lurker');
			return;
		} else if(sockets_list[socket.player.id].status == 'wait'){
			var index = users.indexOf(socket.player.id);
			if(index != -1){
				users.splice(index, 1);
			}
			var wait_list_index = wait_queue.map(function(e) { return e.id; }).indexOf(socket.player);
			if(wait_list_index != -1){
				wait_queue.splice(wait_list_index,1);
			}

		} else{
			console.log('signed in user');
			console.log(socket.player);
			var room = sockets_list[socket.player.id].match_id;
			socket.broadcast.to(room).emit('player_left', {status: 'Player disconnected', player: socket.player});

			var match_id = sockets_list[socket.player.id].match_id;
			console.log(match_id);
			//var match = match_list[match_id].end();
		}
	});

	

});
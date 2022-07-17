const http = require("http"),
  express = require("express"),
  app = express(),
  socketIo = require("socket.io");
const fs = require("fs");

const server = http.Server(app).listen(8080);
const io = socketIo(server);
const clients = {};

app.use(express.static(__dirname + "/../client/"));
app.use(express.static(__dirname + "/../node_modules/"));

app.get("/", (req, res) => {
  const stream = fs.createReadStream(__dirname + "/../client/index.html");
  stream.pipe(res);
});

const addClient = (socket) => {
  console.log("New client connected", socket.id);
  clients[socket.id] = socket;
};
const removeClient = (socket) => {
  console.log("Client disconnected", socket.id);
  delete clients[socket.id];
};

io.sockets.on("connection", (socket) => {
  let id = socket.id;

  addClient(socket);

  socket.on("mousemove", (data) => {
    data.id = id;
    socket.broadcast.emit("moving", data);
  });

  socket.on("disconnect", () => {
    removeClient(socket);
    socket.broadcast.emit("clientdisconnect", id);
  });
});

var players = {},
  unmatched;

function joinGame(socket) {
  players[socket.id] = {
    opponent: unmatched,
    symbol: "X",
    socket: socket,
  };

  if (unmatched) {
    players[socket.id].symbol = "O";
    players[unmatched].opponent = socket.id;
    unmatched = null;
  } else {
    unmatched = socket.id;
  }
}

// Returns the opponent socket
function getOpponent(socket) {
  if (!players[socket.id].opponent) {
    return;
  }

  return players[players[socket.id].opponent].socket;
}

io.on("connection", function (socket) {
  joinGame(socket);

  // Once the socket has an opponent, we can begin the game
  if (getOpponent(socket)) {
    socket.emit("game.begin", {
      symbol: players[socket.id].symbol,
    });

    getOpponent(socket).emit("game.begin", {
      symbol: players[getOpponent(socket).id].symbol,
    });
  }

  //listen to make move from the client prints the req data sended from client to the console
  socket.on("make.move", function (data) {
    console.log(
      "player " +
        socket.id +
        " make move with sign " +
        data.symbol +
        " in position " +
        data.position
    );
    if (!getOpponent(socket)) {
      return;
    }

    //send response to client and prints the req data sended from client to the console
    socket.emit("move.made", data);
    console.log(
      "player " +
        socket.id +
        " move made with sign " +
        data.symbol +
        " in position " +
        data.position
    );
    getOpponent(socket).emit("move.made", data);
  });

  socket.on("game.over", function (message) {
    console.log("Player: " + socket.id + " " + message);
  });

  socket.on("disconnect", function () {
    if (getOpponent(socket)) {
      getOpponent(socket).emit("opponent.left");
    }
  });
});

var websocket = require("websocket");
var http = require("http");
var fs = require("fs");

function getFileData() {
    try {
	var customerData = JSON.parse(fs.readFileSync("customers.json"));
	var invoiceData = JSON.parse(fs.readFileSync("invoices.json"));
	var companyData = JSON.parse(fs.readFileSync("company.json"));
    } catch (err) {
	console.log(err.message);
	process.exit(1);
    }

    return { customers : customerData.customers.map(function(s) { return ({ name: s.name, team: s.team }) ; }),
	     invoices  : invoiceData.rivit,
	     company   : companyData.company };
}

function servicelog(s) {
    console.log((new Date()) + " --- " + s);
}

var pdfprinter = require("./pdfprinter");
var filename = "panthers.pdf";
var globalConnectionList = [];

function serveClientPage() {
    http.createServer(function(request,response){
	clientscript = fs.readFileSync("./client.js", "utf8");
	response.writeHeader(200, {"Content-Type": "text/html"});
	response.write(clientscript);
	response.end();
    }).listen(8080);
}

var server = http.createServer(function(request, response) {
    // process HTTP request. Since we're writing just WebSockets server
    // we don't have to implement anything.
});

server.listen(8081, function() {});

wsServer = new websocket.server({
    httpServer: server
});

wsServer.on('request', function(request) {
    servicelog("Connection from origin " + request.origin);
    var connection = request.accept(null, request.origin);
    var index = globalConnectionList.push(connection) - 1;
    var sendable;
    servicelog("Client #" + index + " accepted");

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            var receivable = JSON.parse(message.utf8Data);

            if(receivable.type == "clientStarted") {
		var clientSendable = getFileData();
		servicelog("Sending initial data to client #" + index);
		sendable = {type:"statusData", content: "hippaheikin laiva on bullaa ja woita!"};
		connection.send(JSON.stringify(sendable));
		sendable = {type:"invoiceData", content:clientSendable};
		connection.send(JSON.stringify(sendable));
            }
	    if (receivable.type == "getPdfPreview") {
		servicelog("Client #" + index + " requestes PDF preview " + receivable.client);
		var sendable = {type:"statusData", content: "Prnting preview"};
		connection.send(JSON.stringify(sendable));

            }
        }
    });

    connection.on('close', function(connection) {
        servicelog("client #" + index + " disconnected");
        globalConnectionList.splice(index, 1);
    });

});

serveClientPage();

//pdfprinter.printSheet(filename, lasku, kamat);

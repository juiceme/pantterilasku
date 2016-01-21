var websocket = require("websocket");
var http = require("http");
var fs = require("fs");

try {
    var customerData = JSON.parse(fs.readFileSync("customers.json"));
    var invoiceData = JSON.parse(fs.readFileSync("invoices.json"));
    var companyData = JSON.parse(fs.readFileSync("company.json"));
} catch (err) {
    console.log(err.message);
    process.exit(1);
}

var pdfprinter = require("./pdfprinter");
var filename = "panthers.pdf";
var globalConnectionList = [];
var clientSendable = { customers : customerData.customers.map(function(s) { return s.name; }),
		       invoices  : invoiceData.rivit,
		       company   : companyData.company };

function servePage(content) {
    http.createServer(function(request,response){
	response.writeHeader(200, {"Content-Type": "text/html"});
	response.write(content);
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
    console.log((new Date()) + " Connection from origin " + request.origin);
    var connection = request.accept(null, request.origin);
    var index = globalConnectionList.push(connection) - 1;
    console.log((new Date()) + " Client #" + index + " accepted");

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
	    var sendable = {type:"invoiceData", content:clientSendable};
            connection.send(JSON.stringify(sendable));
        }
    });

    connection.on('close', function(connection) {
        console.log((new Date()) + " client #" + index + " disconnected");
        globalConnectionList.splice(index, 1);
    });

});

servePage(fs.readFileSync("./client.js", "utf8"));

//pdfprinter.printSheet(filename, lasku, kamat);

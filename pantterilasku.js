var websocket = require("websocket");
var http = require("http");
var fs = require("fs");
var emailjs = require("emailjs");
var pdfprinter = require("./pdfprinter");
var globalConnectionList = [];

function getFileData() {
    try {
	var customerData = JSON.parse(fs.readFileSync("customers.json"));
	var invoiceData = JSON.parse(fs.readFileSync("invoices.json"));
	var companyData = JSON.parse(fs.readFileSync("company.json"));
    } catch (err) {
	console.log(err.message);
	process.exit(1);
    }

    return { customers : customerData.customers.map(function(s) {
	return ({ name: s.name, team: s.team });
    }),
	     invoices  : invoiceData.rows,
	     company   : companyData.company };
}

function servicelog(s) {
    console.log((new Date()) + " --- " + s);
}

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
		setStatustoClient(connection, "Forms are up to date");
		sendable = {type:"invoiceData", content:clientSendable};
		connection.send(JSON.stringify(sendable));
            }
	    if (receivable.type == "getPdfPreview") {
		servicelog("Client #" + index + " requestes PDF preview " + receivable.customer +
			   " [" +  receivable.invoices + "]");
		setStatustoClient(connection, "Printing preview");
		printPreview(pushPreviewToClient, connection, receivable.customer, receivable.invoices);
            }
	    if (receivable.type == "sendInvoices") {
		servicelog("Client #" + index + " requestes bulk mailing" +
			   " [" +  JSON.stringify(receivable.invoices) + "]");
		setStatustoClient(connection, "Sending email");
		sendBulkEmail(connection, receivable.invoices);
            }
        }
    });

    connection.on('close', function(connection) {
        servicelog("client #" + index + " disconnected");
        globalConnectionList.splice(index, 1);
    });

});

function setStatustoClient(connection, status) {
    var sendable = {type:"statusData", content:status};
    connection.send(JSON.stringify(sendable));
}

function getNiceDate(date) {
    return date.getDate() + "." + (date.getMonth()+1) + "." + date.getFullYear();
}
function getniceDateTime(date) {
    return (date.getDate().toString() + (date.getMonth()+1).toString() + date.getFullYear().toString() +
	    date.getHours().toString() + date.getMinutes().toString());
}

function pushPreviewToClient(connection, dummy, filename) {
    if(filename == null) {
	setStatustoClient(connection, "No preview available");
	return;
    }

    fii = fs.readFileSync(filename);
    var sendable = {type:"pdfUpload", content: fii.toString('base64')};
    connection.send(JSON.stringify(sendable));

    setStatustoClient(connection, "OK");

}

function sendEmail(connection, details, filename) {
    console.log(filename);
    console.log(details);
    setStatustoClient(connection, "Naakka istui orrella: " + filename);
}

function printPreview(callback, connection, customer, selectedInvoices)
{
    var customerData = JSON.parse(fs.readFileSync("customers.json"));
    var companyData = JSON.parse(fs.readFileSync("company.json"));
    var invoiceData = JSON.parse(fs.readFileSync("invoices.json"));
    var filename = "./temp/preview.pdf";
    var now = new Date();

    var invoice = invoiceData.rows.map(function(a,b) {
	if(selectedInvoices.indexOf(b) > -1) { return a; }
    }).filter(function(s){ return s; });

    if(invoice.length == 0) {
	servicelog("Invoice empty, not creating PDF preview document");
	setStatustoClient(connection, "No preview available");
	return null;
    }
 
    var company = companyData.company.map(function(s) {
	if(s.id === customerData.customers[customer].team) { return s }
    }).filter(function(s){ return s; })[0];

    var bill = { company: company.name,
		 bankName: company.bankName,
		 bic: company.bic,
		 iban: company.iban,
		 customer: customerData.customers[customer].name,
		 reference: customerData.customers[customer].reference,
		 date: getNiceDate(now),
		 number: "",
		 id: "",
		 intrest: "",
		 expireDate: getNiceDate(new Date(now.valueOf()+(60*60*24*1000*14))),
		 notice: ""
	       }

    pdfprinter.printSheet(callback, connection, {}, filename, bill, invoice);
    servicelog("Created PDF preview document");
}

function sendBulkEmail(connection, allInvoices) {
    var customerData = JSON.parse(fs.readFileSync("customers.json"));
    var companyData = JSON.parse(fs.readFileSync("company.json"));
    var invoiceData = JSON.parse(fs.readFileSync("invoices.json"));
    var now = new Date();
    var billNumber = getniceDateTime(now);

    if(allInvoices.length === 0) {
	servicelog("Invoice empty, not emailing PDF documents");
	setStatustoClient(connection, "No mailing available");
	return null;
    }

    allInvoices.forEach(function(currentCustomer) {
	var customer = customerData.customers.map(function(a, b) {
	    if(currentCustomer.id === b) { return a; }
	}).filter(function(s){ return s; })[0];
	var invoiceRows = invoiceData.rows.map(function(a, b) {
	    if(currentCustomer.invoices.indexOf(b+1) > -1) { return a; }
	}).filter(function(s){ return s; });
	var company = companyData.company.map(function(s) {
	    if(s.id === customer.team) { return s }
	}).filter(function(s){ return s; })[0];

	var bill = { company: company.name,
		     bankName: company.bankName,
		     bic: company.bic,
		     iban: company.iban,
		     customer: customer.name,
		     reference: customer.reference,
		     date: getNiceDate(now),
		     number: billNumber,
		     id: "",
		     intrest: "",
		     expireDate: getNiceDate(new Date(now.valueOf()+(60*60*24*1000*14))),
		     notice: ""
		   }

	var filename = "./temp/" + customer.name.replace(" ", "_") + "_" + billNumber + ".pdf";
	var emailDetails = { address: customer.email,
			     subject: "Uusi lasku " + company.name + " / " + billNumber,
			     text: "Tässä uusi lasku."
			   }
			     

	pdfprinter.printSheet(sendEmail, connection, emailDetails, filename, bill, invoiceRows);
	servicelog("Sent PDF emails");
    });

}

if (!fs.existsSync("./temp/")){ fs.mkdirSync("./temp/"); }
if (!fs.existsSync("./sent_invoices/")){ fs.mkdirSync("./sent_invoices/"); }

serveClientPage();


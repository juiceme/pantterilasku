var websocket = require("websocket");
var http = require("http");
var fs = require("fs");
var email = require("emailjs/email");
var md5=require("md5");
var pdfprinter = require("./pdfprinter");
var path = require("path");
var Aes = require('./crypto/aes.js');
Aes.Ctr = require('./crypto/aes-ctr.js');

var globalConnectionList = [];
var globalSentMailList = [];
var globalSalt = md5(new Date().getTime());
var globalLoginData = {};

try {
    var emailData = JSON.parse(fs.readFileSync("./configuration/email.json"));
    var emailConnection = email.server.connect({
	user: emailData.user,
	password: emailData.password,
	host: emailData.host,
	ssl: emailData.ssl
    });
    globalLoginData = JSON.parse(fs.readFileSync("./configuration/login.json"));
} catch (err) {
    console.log(err.message);
    process.exit(1);
}

function getFileData() {
    try {
	var customerData = JSON.parse(fs.readFileSync("./configuration/customers.json"));
	var invoiceData = JSON.parse(fs.readFileSync("./configuration/invoices.json"));
	var companyData = JSON.parse(fs.readFileSync("./configuration/company.json"));
    } catch (err) {
	console.log(err.message);
	process.exit(1);
    }

    return { customers : customerData.map(function(s) {
	return ({ name: s.name, team: s.team });
    }),
	     invoices  : invoiceData,
	     company   : companyData };
}

function servicelog(s) {
    console.log((new Date()) + " --- " + s);
}

function serveClientPage() {
    http.createServer(function(request,response){
	var clientjs = fs.readFileSync("./client.js", "utf8");
	var aesjs = fs.readFileSync("./crypto/aes.js", "utf8");
	var aesctrjs = fs.readFileSync("./crypto/aes-ctr.js", "utf8");
	var sendable = clientjs + aesjs + aesctrjs + "</script></body></html>";
	response.writeHeader(200, {"Content-Type": "text/html"});
	response.write(sendable);
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
    var startDate = new Date();
    var passwordHash = md5(globalLoginData.password + globalSalt);
    var connectionHash = md5(startDate.getTime() + connection);
    var passwordDoubleHash = md5(passwordHash + connectionHash);
    var index = globalConnectionList.push({ connection: connection,
					    hash: passwordHash,
					    loggedIn: false }) - 1;
    var sendable;
    servicelog("Client #" + index + " accepted");

    connection.on('message', function(message) {

        if (message.type === 'utf8') {
            var receivable = JSON.parse(message.utf8Data);

            if(receivable.type == "clientStarted") {
		servicelog("Sending login challenge to client #" + index);
		sendable = { type: "loginRequest",
			     content: { salt: globalSalt,
					challenge: connectionHash } };
		connection.send(JSON.stringify(sendable));
		setStatustoClient(connection, "Logging in");
	    }
            if(receivable.type == "loginClient") {
		servicelog("Received login attempt from client #" + index);
		if(receivable.content === passwordDoubleHash) {
		    servicelog("Client #" + index + " login OK");
		    setStatustoClient(connection, "Logged in OK");
		    globalConnectionList[index].loggedIn = true;
		    var clientSendable = Aes.Ctr.encrypt(JSON.stringify(getFileData()), passwordHash, 128);
		    servicelog("Sending initial data to client #" + index);
		    setStatustoClient(connection, "Forms are up to date");
		    sendable = {type: "invoiceData",
				content: clientSendable };
		    connection.send(JSON.stringify(sendable));
		} else {
		    servicelog("Client #" + index + " login FAILED");
		    setStatustoClient(connection, "Login failed");
		}
	    }
	    if (receivable.type == "getPdfPreview") {
		servicelog("Client #" + index + " requestes PDF preview " + receivable.customer +
			   " [" +  receivable.invoices + "]");
		setStatustoClient(connection, "Printing preview");
		printPreview(pushPreviewToClient, index, receivable.customer, receivable.invoices);
            }
	    if (receivable.type == "sendInvoices") {
		globalSentMailList = [];
		servicelog("Client #" + index + " requestes bulk mailing" +
			   " [" +  JSON.stringify(receivable.invoices) + "]");
		setStatustoClient(connection, "Sending email");
		sendBulkEmail(connection, receivable.emailText, receivable.invoices);
            }
        }
    });

    connection.on('close', function(connection) {
        servicelog("client #" + index + " disconnected");
        globalConnectionList.splice(index, 1);
    });

});

function setStatustoClient(connection, status) {
    var sendable = { type:"statusData",
		     content: status };
    connection.send(JSON.stringify(sendable));
}

function getNiceDate(date) {
    return date.getDate() + "." + (date.getMonth()+1) + "." + date.getFullYear();
}
function getniceDateTime(date) {
    return (date.getDate().toString() + (date.getMonth()+1).toString() + date.getFullYear().toString() +
	    date.getHours().toString() + date.getMinutes().toString());
}

function pushPreviewToClient(connectionIndex, dummy, filename) {
    if(filename == null) {
	setStatustoClient(globalConnectionList[connectionIndex].connection, "No preview available");
        servicelog("No PDF preview available");
	return;
    }
    if(globalConnectionList[connectionIndex].loggedIn != true) {
	setStatustoClient(globalConnectionList[connectionIndex].connection, "Login failure");
        servicelog("Login failure in PDF preview sending");
	return;
    }

    fii = fs.readFileSync(filename).toString('base64');
    var sendable = { type: "pdfUpload",
		     content: Aes.Ctr.encrypt(fii, globalConnectionList[connectionIndex].hash, 128) };
    globalConnectionList[connectionIndex].connection.send(JSON.stringify(sendable));

    setStatustoClient(globalConnectionList[connectionIndex].connection, "OK");
}

function sendEmail(connection, details, filename) {
    setStatustoClient(connection, "Sending email: " + details.sentCount);
    emailConnection.send({ text: details.text,
			   from: emailData.sender,
			   to: details.address,
			   subject: details.subject,
			   attachment: [ { path: filename,
					   type: "application/pdf",
					   name: details.filename } ]
			 }, function(err, message) {
			     if(err) {
				 console.log(err || message);
				 globalSentMailList.push({ failed: filename });
				 fs.renameSync(filename,  "./failed_invoices/" + path.basename(filename));
				 setStatustoClient(connection, "Failed sending email: " + details.sentCount);
			     } else {
				 globalSentMailList.push({ passed: filename });
				 fs.renameSync(filename,  "./sent_invoices/" + path.basename(filename));
				 setStatustoClient(connection, "Sent email: " + details.sentCount);
			     }
			 });
}

function printPreview(callback, connectionIndex, customer, selectedInvoices)
{
    var customerData = JSON.parse(fs.readFileSync("./configuration/customers.json"));
    var companyData = JSON.parse(fs.readFileSync("./configuration/company.json"));
    var invoiceData = JSON.parse(fs.readFileSync("./configuration/invoices.json"));
    var filename = "./temp/preview.pdf";
    var now = new Date();

    var invoice = invoiceData.map(function(a,b) {
	if(selectedInvoices.indexOf(b) > -1) { return a; }
    }).filter(function(s){ return s; });

    if(invoice.length == 0) {
	servicelog("Invoice empty, not creating PDF preview document");
	setStatustoClient(globalConnectionList[connectionIndex].connection, "No preview available");
	return null;
    }
 
    var company = companyData.map(function(s) {
	if(s.id === customerData[customer].team) { return s }
    }).filter(function(s){ return s; })[0];

    var bill = { company: company.name,
		 bankName: company.bankName,
		 bic: company.bic,
		 iban: company.iban,
		 customer: customerData[customer].name,
		 reference: customerData[customer].reference,
		 date: getNiceDate(now),
		 number: "",
		 id: "",
		 intrest: "",
		 expireDate: getNiceDate(new Date(now.valueOf()+(60*60*24*1000*14))),
		 notice: "" }

    pdfprinter.printSheet(callback, connectionIndex, {}, filename, bill, invoice);
    servicelog("Created PDF preview document");
}

function sendBulkEmail(connection, emailText, allInvoices) {
    var customerData = JSON.parse(fs.readFileSync("./configuration/customers.json"));
    var companyData = JSON.parse(fs.readFileSync("./configuration/company.json"));
    var invoiceData = JSON.parse(fs.readFileSync("./configuration/invoices.json"));
    var now = new Date();
    var billNumber = getniceDateTime(now);
    var customerCount = 0;

    if(allInvoices.length === 0) {
	servicelog("Invoice empty, not emailing PDF documents");
	setStatustoClient(connection, "No mailing available");
	return null;
    }

    allInvoices.forEach(function(currentCustomer) {
	customerCount++;
	var customer = customerData.map(function(a, b) {
	    if(currentCustomer.id === b) { return a; }
	}).filter(function(s){ return s; })[0];
	var invoiceRows = invoiceData.map(function(a, b) {
	    if(currentCustomer.invoices.indexOf(b+1) > -1) { return a; }
	}).filter(function(s){ return s; });
	var company = companyData.map(function(s) {
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
		     notice: "" }

	var filename = "./temp/" + customer.name.replace(" ", "_") + "_" + billNumber + ".pdf";
	var emailDetails = { address: customer.email,
			     subject: "Uusi lasku " + company.name + " / " + billNumber,
			     text: emailText,
			     filename: customer.name.replace(" ", "_") + "_" + billNumber + ".pdf",
			     sentCount: customerCount }

	pdfprinter.printSheet(sendEmail, connection, emailDetails, filename, bill, invoiceRows);
	servicelog("Sent PDF emails");
    });

}

if (!fs.existsSync("./temp/")){ fs.mkdirSync("./temp/"); }
if (!fs.existsSync("./sent_invoices/")){ fs.mkdirSync("./sent_invoices/"); }
if (!fs.existsSync("./failed_invoices/")){ fs.mkdirSync("./failed_invoices/"); }

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

servicelog("Waiting for client connection to port 8080...");
serveClientPage();

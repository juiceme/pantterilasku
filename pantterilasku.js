var websocket = require("websocket");
var http = require("http");
var fs = require("fs");
var email = require("emailjs/email");
var pdfprinter = require("./pdfprinter");
var path = require("path");
var Aes = require('./crypto/aes.js');
Aes.Ctr = require('./crypto/aes-ctr.js');
var sha1 = require('./crypto/sha1.js');
var datastorage = require('./datastorage/datastorage.js');

var globalSalt = sha1.hash(JSON.stringify(new Date().getTime()));

function servicelog(s) {
    console.log((new Date()) + " --- " + s);
}

function setStatustoClient(cookie, status) {
    var sendable = { type: "statusData",
		     content: status };
    cookie.connection.send(JSON.stringify(sendable));
}

function getNiceDate(date) {
    return date.getDate() + "." + (date.getMonth()+1) + "." + date.getFullYear();
}

function getniceDateTime(date) {
    return (date.getDate().toString() + (date.getMonth()+1).toString() + date.getFullYear().toString() +
	    date.getHours().toString() + date.getMinutes().toString());
}

function sendPlainTextToClient(cookie, sendable) {
    cookie.connection.send(JSON.stringify(sendable));
}

function sendCipherTextToClient(cookie, sendable) {
    var cipherSendable = { type: sendable.type,
			   content: Aes.Ctr.encrypt(JSON.stringify(sendable.content),
						    cookie.aesKey, 128) };
    cookie.connection.send(JSON.stringify(cipherSendable));
}

function printLanguageVariable(tag, language) {
    return "var " + tag + " = \"" + getLanguageText(language, tag) + "\";"
}

function getClientVariables(language) {
    var language = mainConfig.main.language;
    return "var WEBSOCK_PORT = " + mainConfig.main.port + ";\n" +
	printLanguageVariable("HELPTEXT_LOGIN_A", language) + "\n" +
	printLanguageVariable("HELPTEXT_LOGIN_B", language) + "\n" +
	printLanguageVariable("HELPTEXT_LOGIN_C", language) + "\n" +
	printLanguageVariable("HELPTEXT_EMAIL_A", language) + "\n" +
	printLanguageVariable("HELPTEXT_EMAIL_B", language) + "\n" +
	printLanguageVariable("HELPTEXT_USER_A", language) + "\n" +
	printLanguageVariable("HELPTEXT_USER_B", language) + "\n" +
	printLanguageVariable("HELPTEXT_USER_C", language) + "\n" +
	printLanguageVariable("HELPTEXT_USER_D", language) + "\n\n";
}

var webServer = http.createServer(function(request,response){
    var clienthead = fs.readFileSync("./clienthead", "utf8");
    var variables = getClientVariables();
    var clientbody = fs.readFileSync("./client.js", "utf8");
    var aesjs = fs.readFileSync("./crypto/aes.js", "utf8");
    var aesctrjs = fs.readFileSync("./crypto/aes-ctr.js", "utf8");
    var sha1js = fs.readFileSync("./crypto/sha1.js", "utf8");
    var sendable = clienthead + variables + clientbody + aesjs + aesctrjs + sha1js + "</script></body></html>";
    response.writeHeader(200, { "Content-Type": "text/html",
                                "X-Frame-Options": "deny",
                                "X-XSS-Protection": "1; mode=block",
                                "X-Content-Type-Options": "nosniff" });
    response.write(sendable);
    response.end();
    servicelog("Respond with client to: " + JSON.stringify(request.headers));
});

wsServer = new websocket.server({
    httpServer: webServer,
    autoAcceptConnections: false
});

var connectionCount = 0;

wsServer.on('request', function(request) {
    servicelog("Connection from origin " + request.origin);
    var connection = request.accept(null, request.origin);
    var cookie = { count:connectionCount++, connection:connection, state:"new" };
    var sendable;
    servicelog("Client #" + cookie.count  + " accepted");

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
	    try {
		var receivable = JSON.parse(message.utf8Data);
	    } catch(err) {
		servicelog("Received illegal message: " + err);
		return;
	    }
	    if(!receivable.type || !receivable.content) {
		servicelog("Received broken message: " + JSON.stringify(receivable));
		return;
	    }

	    servicelog("Incoming message: " + JSON.stringify(receivable));
	    var type = receivable.type;
	    var content = receivable.content;

            if(type === "clientStarted") { processClientStarted(cookie); }
	    if(type === "userLogin") { processUserLogin(cookie, content); }
	    if(type === "loginResponse") { processLoginResponse(cookie, content); }
	    if(type === "createAccount") { processCreateAccount(cookie, content); }
	    if((type === "confirmEmail") &&
	       stateIs(cookie, "clientStarted")) { processConfirmEmail(cookie, content); }
	    if((type === "validateAccount") &&
	       stateIs(cookie, "clientStarted")) { processValidateAccount(cookie, content); }

	    if((type === "getPdfPreview") &&
	       stateIs(cookie, "loggedIn")) { processPdfPreview(cookie, content); }
	    if((type === "sendInvoices") &&
	       stateIs(cookie, "loggedIn")) { processSendInvoices(cookie, content); }
	    if((type === "resetToMain") &&
	       stateIs(cookie, "loggedIn")) { processResetToMainState(cookie, content); }
	    if((type === "saveCustomerList") &&
	       stateIs(cookie, "loggedIn")) { processSaveCustomerList(cookie, content); }
	    if((type === "saveInvoiceList") &&
	       stateIs(cookie, "loggedIn")) { processSaveInvoiceList(cookie, content); }

	}
    });

    connection.on('close', function(connection) {
	servicelog("Client #" + cookie.count  + " disconnected");
        cookie = {};
    });
});

function stateIs(cookie, state) {
    return (cookie.state === state);
}

function setState(cookie, state) {
    cookie.state = state;
}

function processClientStarted(cookie) {
    if(cookie["user"] !== undefined) {
	if(cookie.user["username"] !== undefined) {
	    servicelog("User " + cookie.user.username + " logged out");
	}
    }
    servicelog("Sending initial login view to client #" + cookie.count);
    setState(cookie, "clientStarted");
    cookie.aesKey = "";
    cookie.user = {};
    cookie.challenge = "";
    var sendable = { type: "loginView" }
    sendPlainTextToClient(cookie, sendable);
    setStatustoClient(cookie, "Login");
}

function processUserLogin(cookie, content) {
    var sendable;
    if(!content.username) {
	servicelog("Illegal user login message");
	processClientStarted(cookie);
	return;
    } else {
	var user = getUserByHashedName(content.username);
	if(user.length === 0) {
	    servicelog("Unknown user login attempt");
	    processClientStarted(cookie);
	    return;
	} else {
	    cookie.user = user[0];
	    cookie.aesKey = user[0].password;
	    servicelog("User " + user[0].username + " logging in");
	    var plainChallenge = getNewChallenge();
	    servicelog("plainChallenge:   " + plainChallenge);
	    cookie.challenge = JSON.stringify(plainChallenge);
	    sendable = { type: "loginChallenge",
			 content: plainChallenge };
	    sendCipherTextToClient(cookie, sendable);
	}
    }
}

function processLoginResponse(cookie, content) {
    var sendable;
    var plainResponse = Aes.Ctr.decrypt(content, cookie.user.password, 128);
    if(cookie.challenge === plainResponse) {
	servicelog("User login OK");
	setState(cookie, "loggedIn");
	setStatustoClient(cookie, "Login OK");
	if(getUserPriviliges(cookie.user).length === 0) {
	    sendable = { type: "unpriviligedLogin", content: "<b>Käyttäjätunnuksesi on luotu onnistuneesti.</b><br><br>Jotta voit aloittaa Pantterilaskun käytön, pyydä käyttöoikeudet ylläpidolta;<br><br>Lähetä söhköpostia osoitteeseen juice@swagman.org ja kerro joukkueesi nimi." };
	    sendCipherTextToClient(cookie, sendable);
	    servicelog("Sent unpriviligedLogin info to client #" + cookie.count);
	} else {
	    cookie.invoiceData = createUserInvoiceData(cookie.user.username);
            sendable = { type: "invoiceData",
			 content: cookie.invoiceData };
	    sendCipherTextToClient(cookie, sendable);
	    servicelog("Sent invoiceData to client #" + cookie.count);
	}
    } else {
	servicelog("User login failed on client #" + cookie.count);
	processClientStarted(cookie);
    }
}

function processResetToMainState(cookie, content) {
    var sendable;
    servicelog("User session reset to main state");
    cookie.invoiceData = createUserInvoiceData(cookie.user.username);
    sendable = { type: "invoiceData",
		 content: cookie.invoiceData };
    sendCipherTextToClient(cookie, sendable);
    servicelog("Sent invoiceData to client #" + cookie.count);
}

function processSaveCustomerList(cookie, content) {
    var sendable;
    var invoiceData = JSON.parse(Aes.Ctr.decrypt(content, cookie.user.password, 128));
    servicelog("Client #" + cookie.count + " requests customer list saving: " + JSON.stringify(invoiceData.customers));
    if(userHasCustomerEditPrivilige(cookie.user)) {
	updateCustomersFromClient(cookie, invoiceData.customers);
	cookie.invoiceData = createUserInvoiceData(cookie.user.username);
    } else {
	servicelog("user has insufficent priviliges to edit customer tables");
    }
    sendable = { type: "invoiceData", content: cookie.invoiceData };
    sendCipherTextToClient(cookie, sendable);
    servicelog("Sent invoiceData to client #" + cookie.count);
}

function processSaveInvoiceList(cookie, content) {
    var sendable;
    var invoiceData = JSON.parse(Aes.Ctr.decrypt(content, cookie.user.password, 128));
    servicelog("Client #" + cookie.count + " requests invoice list saving: " + JSON.stringify(invoiceData.invoices));
    if(userHasInvoiceEditPrivilige(cookie.user)) {
	updateInvoicesFromClient(cookie, invoiceData.invoices);
	cookie.invoiceData = createUserInvoiceData(cookie.user.username);
    } else {
	servicelog("user has insufficent priviliges to edit invoice tables");
    }
    sendable = { type: "invoiceData", content: cookie.invoiceData };
    sendCipherTextToClient(cookie, sendable);
    servicelog("Sent invoiceData to client #" + cookie.count);
}

function processPdfPreview(cookie, content) {
    var previewData = JSON.parse(Aes.Ctr.decrypt(content, cookie.user.password, 128));
h    servicelog("Client #" + cookie.count + " requestes PDF preview " + JSON.stringify(previewData.invoices));
    setStatustoClient(cookie, "Printing preview");
    printPreview(pushPreviewToClient, cookie, previewData.customer, previewData.invoices);
}

function processSendInvoices(cookie, content) {
    cookie.sentMailList = [];
    var invoiceData = JSON.parse(Aes.Ctr.decrypt(content, cookie.user.password, 128));
    servicelog("Client #" + cookie.count + " requestes bulk mailing" + JSON.stringify(invoiceData.invoices));
    if(userHasSendEmailPrivilige(cookie.user)) {
	setStatustoClient(cookie, "Sending bulk email");
	sendBulkEmail(cookie, invoiceData.emailText, invoiceData.invoices);
    } else {
	servicelog("user has insufficent priviliges to send email");
	setStatustoClient(cookie, "Cannot send email!");
    }
}

function printPreview(callback, cookie, customer, selectedInvoices)
{
    var filename = "./temp/preview.pdf";
    var now = new Date();

    var invoice = cookie.invoiceData.invoices.map(function(a, b) {
	if(selectedInvoices.map(function(e) {
	    return e.item;
	}).indexOf(b) >= 0) {
	    a.n = selectedInvoices[selectedInvoices.map(function(e) {
		return e.item;
	    }).indexOf(b)].count;
	    return a;
	}
    }).filter(function(s){ return s; });

    servicelog(JSON.stringify(invoice));

    if(invoice.length == 0) {
	servicelog("Invoice empty, not creating PDF preview document");
	setStatustoClient(cookie, "No preview available");
	return null;
    }
  
    var company = cookie.invoiceData.company.map(function(s) {
	if(s.id === cookie.invoiceData.customers[customer].team) { return s }
    }).filter(function(s){ return s; })[0];

    var bill = { company: company.name,
		 bankName: company.bankName,
		 bic: company.bic,
		 iban: company.iban,
		 customer: cookie.invoiceData.customers[customer].name,
		 reference: cookie.invoiceData.customers[customer].reference,
		 date: getNiceDate(now),
		 number: "",
		 id: "",
		 intrest: "",
		 expireDate: getNiceDate(new Date(now.valueOf()+(60*60*24*1000*14))),
		 notice: "" }

    pdfprinter.printSheet(callback, cookie, {}, filename, bill, invoice);
    servicelog("Created PDF preview document");
}

function sendBulkEmail(cookie, emailText, allInvoices) {
    var customerData = datastorage.read("customers");
    var companyData = datastorage.read("company");
    var invoiceData = datastorage.read("invoices");
    var now = new Date();
    var billNumber = getniceDateTime(now);
    var customerCount = 0;

    if(allInvoices.length === 0) {
	servicelog("Invoice empty, not emailing PDF documents");
	setStatustoClient(cookie, "No mailing available");
	return null;
    }

    allInvoices.forEach(function(currentCustomer) {
	customerCount++;
	var customer = customerData.customers.map(function(a, b) {
	    if(currentCustomer.id === b) { return a; }
	}).filter(function(s){ return s; })[0];

	var invoiceRows = invoiceData.invoices.map(function(a, b) {
	    if(currentCustomer.invoices.map(function(e) {
		return e.item;
	    }).indexOf(b) >= 0) {
		a.n = currentCustomer.invoices[currentCustomer.invoices.map(function(e) {
		    return e.item;
		}).indexOf(b)].count;
		return a;
	    }
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
		     notice: "" }

	var customerName = customer.name.replace(" ", "_");
	customerName = customerName.replace("/", "_");
	var filename = "./temp/" + customerName + "_" + billNumber + ".pdf";

	var mailDetails = { text: emailText,
			    to:  customer.email,
			    subject: "Uusi lasku " + company.name + " / " + billNumber,
			    attachment: [ { path: filename,
					    type: "application/pdf",
					    name: customer.name.replace(" ", "_") + "_" + billNumber + ".pdf" }]};

	servicelog("invoiceRows: " + JSON.stringify(invoiceRows));

	pdfprinter.printSheet(sendEmail, cookie, mailDetails, filename, bill, invoiceRows, "invoice sending");
	servicelog("Sent PDF emails");
    });
}

function pushPreviewToClient(cookie, dummy1, filename) {
    if(filename == null) {
	setStatustoClient(cookie, "No preview available");
        servicelog("No PDF preview available");
	return;
    }
    if(!stateIs(cookie, "loggedIn")) {
	setStatustoClient(cookie, "Login failure");
        servicelog("Login failure in PDF preview sending");
	return;
    }
    try {
	var pdfFile = fs.readFileSync(filename).toString("base64");
    } catch(err) {
	servicelog("Failed to load PDF preview file: " + err);
	setStatustoClient(cookie, "PDF load failure!");
	return;
    }
    var sendable = { type: "pdfUpload",
		     content: pdfFile };
    sendCipherTextToClient(cookie, sendable);
    setStatustoClient(cookie, "OK");
}

function updateCustomersFromClient(cookie, customers) {
    var customerData = datastorage.read("customers");

    var checkedCustomers = customers.map(function(c) {
	if(cookie.user.teams.indexOf(c.team) >= 0) { return c; }
    }).filter(function(s){ return s; });

    var newCustomerData = { customers : [] };
    customerData.customers.forEach(function(c) {
	if(checkedCustomers.filter(function(f) {
	    return (f.team === c.team);
	}).length == 0) {
	    newCustomerData.customers.push(c);
	}
    });
    checkedCustomers.forEach(function(c) {
	newCustomerData.customers.push(c);
    });
    
    if(datastorage.write("customers", newCustomerData) === false) {
	servicelog("Customer database write failed");
    } else {
	servicelog("Updated Customer database: " + JSON.stringify(newCustomerData));
    }
}

function updateInvoicesFromClient(cookie, invoices) {
    var invoiceData = datastorage.read("invoices");

    var checkedInvoices = invoices.map(function(c) {
	if(c.user === cookie.user.username) { return c; }
    }).filter(function(s){ return s; });

    var newInvoiceData = { defaultEmailText : invoiceData.defaultEmailText, invoices : [] };
    invoiceData.invoices.forEach(function(c) {
	if(checkedInvoices.filter(function(f) {
	    return (f.user === c.user);
	}).length == 0) {
	    newInvoiceData.invoices.push(c);
	}
    });
    checkedInvoices.forEach(function(c) {
	newInvoiceData.invoices.push(c);
    });
    
    if(datastorage.write("invoices", newInvoiceData) === false) {
	servicelog("Invoice database write failed");
    } else {
	servicelog("Updated Invoice database: " + JSON.stringify(newInvoiceData));
    }
}

function processCreateAccount(cookie, content) {
    var sendable;
    servicelog("temp passwd: " + JSON.stringify(cookie.aesKey));
    var account = JSON.parse(Aes.Ctr.decrypt(content, cookie.aesKey, 128));

    if(typeof(account) !== "object") {
	servicelog("Received illegal account creation data");
	return false;
    }
    if(account["username"] === undefined) {
	servicelog("Received account creation data without username");
	return false;
    }

    if(stateIs(cookie, "newUserValidated")) {
	servicelog("Request for new user: [" + account.username + "]");
	if(!createAccount(account)) {
	    servicelog("Cannot create account " + account.username);
	    // there are more possible reasons than already existing account, however user needs
	    // not know about that, hence display only "Account already exists!" in client...
	    setStatustoClient(cookie, "Account already exists!");
	    sendable = { type: "createNewAccount" };
	    sendPlainTextToClient(cookie, sendable);
	    return;
	} else {
	    processClientStarted(cookie);
	    setStatustoClient(cookie, "Account created!");
	    var emailSubject = getLanguageText(mainConfig.main.language, "NEW_ACCOUNT_CONFIRM_SUBJECT");
	    var emailAdminSubject = getLanguageText(mainConfig.main.language, "NEW_ACCOUNT_CONFIRM_ADMIN_SUBJECT");
	    var emailBody = fillTagsInText(getLanguageText(mainConfig.main.language,
							   "NEW_ACCOUNT_CONFIRM_GREETING"),
					   account.username,
					   mainConfig.main.siteFullUrl);
	    var emailAdminBody = fillTagsInText(getLanguageText(mainConfig.main.language,
								"NEW_ACCOUNT_CONFIRM_ADMIN_GREETING"),
						account.username);

	    var mailDetailsUser = { text: emailBody,
				    to: account.email,
				    subject: emailSubject };

	    var mailDetailsAdmin = { text: emailAdminBody,
				     to: mainConfig.main.adminEmailAddess,
				     subject: emailAdminSubject };

	    sendEmail(cookie, mailDetailsUser, false, "account creation");
	    sendEmail(cookie, mailDetailsAdmin, false, "account creation");

	    return;
	}
    }
    if(stateIs(cookie, "oldUserValidated")) {
	servicelog("Request account change for user: [" + account.username + "]");
	var user = getUserByUserName(account.username);
	if(user.length === 0) {
	    processClientStarted(cookie);
	    setStatustoClient(cookie, "Illegal user operation!");
	    return;
	} else {
	    if(updateUserAccount(cookie, account)) {
		setStatustoClient(cookie, "Account updated!");
	    } else {
		setStatustoClient(cookie, "Account update failed!");
	    }
	    processClientStarted(cookie);
	    return;
	}
    }
}

function processConfirmEmail(cookie, content) {
    servicelog("Request for email verification: [" + content + "]");
    sendVerificationEmail(cookie, content);
    processClientStarted(cookie);
    setStatustoClient(cookie, "Email sent!");
}

function processValidateAccount(cookie, content) {
    if(!content.email || !content.challenge) {
	servicelog("Illegal validate account message");
	processClientStarted(cookie);
	return;
    } else {
	servicelog("Validation code: " + JSON.stringify(content));
	account = validateAccountCode(content.email.toString());
	if((account !== false) && (Aes.Ctr.decrypt(content.challenge, account.token.key, 128)
				   === "clientValidating")) {
	    setState(cookie, "newUserValidated");
	    setStatustoClient(cookie, "Validation code correct!");
	    cookie.aesKey = account.token.key;
	    var newAccount = {email: account.email};
	    newAccount.buttonText = "Create Account!";
	    var user = getUserByEmail(account.email);
	    if(user.length !== 0) {
		newAccount.username = user[0].username;
		newAccount.realname = user[0].realname;
		newAccount.phone = user[0].phone;
		newAccount.buttonText = "Save Account!"
		setState(cookie, "oldUserValidated");
	    }
	    sendable = { type: "createNewAccount",
			 content: newAccount };
	    sendCipherTextToClient(cookie, sendable);
	    return;
	} else {
	    processClientStarted(cookie);
	    setStatustoClient(cookie, "Validation code failed!");
	    return;
	}
    }
}

function readUserData() {
    userData = datastorage.read("users");
    if(userData === false) {
	servicelog("User database read failed");
    } 
    return userData;
 }

function updateUserAccount(cookie, account) {
    var userData = readUserData();
    var oldUserAccount = getUserByUserName(account.username);
    if(oldUserAccount.length === 0) {
	return false;
    } else {
	var newUserData = { users : [] };
	newUserData.users = userData.users.filter(function(u) {
	    return u.username !== account.username;
	});
	var newUserAccount = { username: account.username,
			       hash: sha1.hash(account.username),
			       password: account.password,
			       priviliges: oldUserAccount[0].priviliges,
			       teams: oldUserAccount[0].teams };
	if(account["realname"] !== undefined) { newUserAccount.realname = account.realname; }
	if(account["email"] !== undefined) { newUserAccount.email = account.email; }
	if(account["phone"] !== undefined) { newUserAccount.phone = account.phone; }
	newUserData.users.push(newUserAccount);
	if(datastorage.write("users", newUserData) === false) {
	    servicelog("User database write failed");
	} else {
	    servicelog("Updated User Account: " + JSON.stringify(newUserAccount));
	}
	var emailSubject = getLanguageText(mainConfig.main.language, "PASSWORD_RESET_CONFIRM_SUBJECT");
	var emailAdminSubject = getLanguageText(mainConfig.main.language, "PASSWORD_RESET_CONFIRM_ADMIN_SUBJECT");
	var emailBody = fillTagsInText(getLanguageText(mainConfig.main.language,
						       "PASSWORD_RESET_CONFIRM_GREETING"),
				       account.username,
				       mainConfig.main.siteFullUrl);
	var emailAdminBody = fillTagsInText(getLanguageText(mainConfig.main.language,
							    "PASSWORD_RESET_CONFIRM_ADMIN_GREETING"),
					    account.username);

	var mailDetailsUser = { text: emailBody,
				to: account.email,
				subject: emailSubject };

	var mailDetailsAdmin = { text: emailAdminBody,
				 to: mainConfig.main.adminEmailAddess,
				 subject: emailAdminSubject };

	sendEmail(cookie, mailDetailsUser, false, "account update");
	sendEmail(cookie, mailDetailsAdmin, false, "account update");
	return true;
    }
}

function userHasCustomerEditPrivilige(user) {
    if(user.priviliges.length === 0) { return false; }
    if(user.priviliges.indexOf("customer-edit") < 0) { return false; }
    return true;
}

function userHasInvoiceEditPrivilige(user) {
    if(user.priviliges.length === 0) { return false; }
    if(user.priviliges.indexOf("invoice-edit") < 0) { return false; }
    return true;
}

function userHasSendEmailPrivilige(user) {
    if(user.priviliges.length === 0) { return false; }
    if(user.priviliges.indexOf("email-send") < 0) { return false; }
    return true;
}

function getUserPriviliges(user) {
    if(user.priviliges.length === 0) { return []; }
    if(user.priviliges.indexOf("none") > -1) { return []; }
    return user.priviliges;
}

function getUserByUserName(username) {
    return readUserData().users.filter(function(u) {
	return u.username === username;
    });
}

function getUserByEmail(email) {
    return readUserData().users.filter(function(u) {
	return u.email === email;
    });
}

function getUserByHashedName(hash) {
    return readUserData().users.filter(function(u) {
	return u.hash === hash;
    });
}

function createAccount(account) {
    if(account["password"] === undefined) {
	servicelog("Received account creation data without password");
	return false;
    }
    var userData = readUserData();
    if(userData.users.filter(function(u) {
	return u.username === account.username;
    }).length !== 0) {
	servicelog("Cannot create an existing user account");
	return false;
    } else {
	var newAccount = { username: account.username,
			   hash: sha1.hash(account.username),
			   password: account.password,
			   priviliges: [ "none" ],
			   teams: [] };
	if(account["realname"] !== undefined) { newAccount.realname = account.realname; }
	if(account["email"] !== undefined) { newAccount.email = account.email; }
	if(account["phone"] !== undefined) { newAccount.phone = account.phone; }
	userData.users.push(newAccount);
	if(datastorage.write("users", userData) === false) {
	    servicelog("User database write failed");
	    return false;
	} else {
	    return true;
	}
    }
}

function validateAccountCode(code) {
    var userData = datastorage.read("pending");
    if(Object.keys(userData.pending).length === 0) {
	servicelog("Empty pending requests database, bailing out");
	return false;
    } 
    var target = userData.pending.filter(function(u) {
	return u.token.mail === code.slice(0, 8);
    });
    if(target.length === 0) {
	return false;
    } else {
	var newUserData = { pending : [] };
	newUserData.pending = userData.pending.filter(function(u) {
	    return u.token.mail !== code.slice(0, 8);
	});

	if(datastorage.write("pending", newUserData) === false) {
	    servicelog("Pending requests database write failed");
	} else {
	    servicelog("Removed pending request from database");
	}
	return target[0];
    }
}

function removePendingRequest(cookie, emailAdress) {
    var userData = datastorage.read("pending");
    if(Object.keys(userData.pending).length === 0) {
	servicelog("Empty pending requests database, bailing out");
	return;
    }
    if(userData.pending.filter(function(u) {
	return u.email === emailAdress;
    }).length !== 0) {
	servicelog("Removing duplicate entry from pending database");
	var newUserData = { pending : [] };
	newUserData.pending = userData.pending.filter(function(u) {
            return u.email !== emailAdress;
	});
	if(datastorage.write("pending", newUserData) === false) {
            servicelog("Pending requests database write failed");
	}
    } else {
	servicelog("no duplicate entries in pending database");
    }
}

function sendVerificationEmail(cookie, recipientAddress) {
    removePendingRequest(cookie, recipientAddress);
    var pendingData = datastorage.read("pending");
    var emailData = datastorage.read("email");
    var timeout = new Date();
    var emailToken = generateEmailToken(recipientAddress);
    timeout.setHours(timeout.getHours() + 24);
    var request = { email: recipientAddress,
                    token: emailToken,
                    date: timeout.getTime() };
    pendingData.pending.push(request);
    if(datastorage.write("pending", pendingData) === false) {
	servicelog("Pending database write failed");
    }
    if(getUserByEmail(recipientAddress).length === 0) {
	var emailSubject = getLanguageText(mainConfig.main.language, "NEW_ACCOUNT_REQUEST_SUBJECT");
	var emailBody = fillTagsInText(getLanguageText(mainConfig.main.language,
						       "NEW_ACCOUNT_REQUEST_GREETING"),
				       (request.token.mail + request.token.key));
    } else {
	var emailSubject = getLanguageText(mainConfig.main.language, "PASSWORD_RESET_SUBJECT");
	var emailBody = fillTagsInText(getLanguageText(mainConfig.main.language,
						       "PASSWORD_RESET_GREETING"),
				       getUserByEmail(recipientAddress)[0].username,
				       (request.token.mail + request.token.key));
    }

    var mailDetails = { text: emailBody,
			to: recipientAddress,
			subject: emailSubject };

    sendEmail(cookie, mailDetails, false, "account verification");
}

function sendReservationEmail(cookie, reservationTotals) { }

function sendEmail(cookie, emailDetails, filename, logline) {
    var emailData = datastorage.read("email");
    if(emailData.blindlyTrust) {
	servicelog("Trusting self-signed certificates");
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    emailDetails.from = emailData.sender;

    email.server.connect({
	user: emailData.user,
	password: emailData.password,
	host: emailData.host,
	ssl: emailData.ssl
    }).send(emailDetails, function(err, message) {
	if(err) {
	    servicelog(err + " : " + JSON.stringify(message));
	    setStatustoClient(cookie, "Failed sending email!");
	    if(filename) {
		cookie.sentMailList.push({ failed: filename });
		fs.renameSync(filename,  "./failed_invoices/" + path.basename(filename));
	    }
	} else {
	    servicelog("Sent " + logline + " email to " + emailDetails.to);
	    setStatustoClient(cookie, "Sent email");
	    if(filename) {
		cookie.sentMailList.push({ passed: filename });
		fs.renameSync(filename,  "./sent_invoices/" + path.basename(filename));
	    }
	}
    });
}

function generateEmailToken(email) {
    return { mail: sha1.hash(email).slice(0, 8),
	     key: sha1.hash(globalSalt + JSON.stringify(new Date().getTime())).slice(0, 16) };
}

function getNewChallenge() {
    return ("challenge_" + sha1.hash(globalSalt + new Date().getTime().toString()) + "1");
}



// ---------


function createUserInvoiceData(username) {
    var user = getUserByUserName(username)[0];
    var customerData = datastorage.read("customers");
    var invoiceData = datastorage.read("invoices");
    var companyData = datastorage.read("company");
    var defaultEmailText = invoiceData.defaultEmailText;

    var ownCustomers = [];
    customerData.customers.forEach(function(customer) {
	if(user.teams.indexOf(customer.team) >= 0) {
	    ownCustomers.push(customer);
	}
    });
    var ownInvoices = [];
    invoiceData.invoices.forEach(function(item) {
	if(user.username === item.user) {
	    ownInvoices.push(item);
	}
    });
    var ownCompany = [];
    companyData.company.forEach(function(company) {
	if(user.teams.indexOf(company.id) >= 0) {
	    ownCompany.push(company);
	}
    });

    ownCustomers = sortByKey(ownCustomers, "name");
    return { customers : ownCustomers,
	     invoices : ownInvoices,
	     company : ownCompany,
	     defaultEmailText : defaultEmailText,
	     user : user.username,
	     teams : user.teams,
	     priviliges : user.priviliges };
}


// ---------


function sortByKey(array, key) {
    return array.sort(function(a, b) {
        var x = a[key];
        var y = b[key];
        if (typeof x == "string") {
            x = (""+x).toLowerCase(); 
        }
        if (typeof y == "string") {
            y = (""+y).toLowerCase();
        }
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}

function getLanguageText(language, tag) {
    var langData = datastorage.read("language");
    var langIndex = langData.language.indexOf(language);
    if(++langIndex === 0) { return false; }
    if(langData.substitution.filter(function(f) { return f.tag === tag }).length === 0) { return false; }
    return langData.substitution.filter(function(f) { return f.tag === tag })[0]["LANG" + langIndex];
}

function fillTagsInText(text) {
    for(var i = 1; i < arguments.length; i++) {
	var substituteString = "_SUBSTITUTE_TEXT_" + i + "_";
	text = text.replace(substituteString, arguments[i]);
    }
    return text;
}

setInterval(function() {
    var now = new Date().getTime();
    var userData = datastorage.read("pending");
    if(Object.keys(userData.pending).length === 0) {
	servicelog("No pending requests to purge");
	return;
    }
    
    var purgeCount = 0
    var newUserData = { pending : [] };
    userData.pending.forEach(function(r) {
	if(r.date < now) {
	    purgeCount++;
	} else {
	    newUserData.pending.push(r);
	}
    });

    if(purgeCount === 0) {
	servicelog("No pending requests timeouted");
	return;
    } else {
	if(datastorage.write("pending", newUserData) === false) {
	    servicelog("Pending requests database write failed");
	} else {
	    servicelog("Removed " + purgeCount + " timeouted pending requests");
	}
    }
}, 1000*60*60);

if (!fs.existsSync("./temp/")){ fs.mkdirSync("./temp/"); }
if (!fs.existsSync("./sent_invoices/")){ fs.mkdirSync("./sent_invoices/"); }
if (!fs.existsSync("./failed_invoices/")){ fs.mkdirSync("./failed_invoices/"); }

// datastorage.setLogger(servicelog);
datastorage.initialize("main", { main : { port : 8080,
					  language : "english",
					  adminEmailAddess : "you <username@your-email.com>",
					  siteFullUrl : "http://url.to.pantterilasku/" } });
datastorage.initialize("language", { language : [ "finnish" , "english" ],
				     substitution : [] });
datastorage.initialize("users", { users : [] }, true);
datastorage.initialize("pending", { pending : [] }, true);
datastorage.initialize("customers", { customers : [] }, true);
datastorage.initialize("invoices", { invoices : [] }, true);
datastorage.initialize("company", { company : [] }, true);
datastorage.initialize("email", { host : "smtp.your-email.com",
				  user : "username",
				  password : "password",
				  sender : "you <username@your-email.com>",
				  ssl : true,
				  blindlyTrust : true });

var mainConfig = datastorage.read("main");

webServer.listen(mainConfig.main.port, function() {
    servicelog("Waiting for client connection to port " + mainConfig.main.port + "...");
});

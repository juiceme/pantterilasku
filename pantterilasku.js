var framework = require("./framework/framework.js");
var fs = require("fs");
var email = require("emailjs/email");
var pdfprinter = require("./pdfprinter");
var path = require("path");
var datastorage = require('./datastorage/datastorage.js');
var archiver = require("archiver");
var util = require('util')

var databaseVersion = 1;


// Application specific part starts from here

function handleApplicationMessage(cookie, decryptedMessage) {
    
//    framework.servicelog("Got message: " + JSON.stringify(decryptedMessage));

    if(decryptedMessage.type === "resetToMain") {
	processResetToMainState(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "getCustomersDataForEdit") {
	processGetCustomersDataForEdit(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "getInvoicesForEdit") {
	processGetInvoicesForEdit(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "itemCountSelectorClicked") {
	processItemCountSelectorClicked(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "itemCountSelectorSelected") {
	processItemCountSelectorSelected(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "linkClicked") {
	processLinkClicked(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "invoiceSelectorSelected") {
	processInvoiceSelectorSelected(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "saveAllCustomersData") {
	processSaveAllCustomersData(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "saveAllInvoiceData") {
	processSaveAllInvoiceData(cookie, decryptedMessage.content); }

}


// helpers

function getApplicationData(cookie) {
    return cookie.user.applicationData;
}

function getCustomersByCompany(team) {
    var customers = [];
    datastorage.read("customers").customers.forEach(function(c) {
	if(c.team === team) { customers.push(c); }
    });
    return customers;
}

function createClickerElement(id, state, value) {
    return [ framework.createUiCheckBox("tick", state, "tick", true,
					"sendToServerEncrypted('itemCountSelectorClicked', { id: " + id + ", state: document.getElementById(this.id).checked } );"),
	     framework.createUiSelectionList("sel", [1,2,3,4,5,6,7,8,9], value, true, !state, false,
					     "var nSelection = document.getElementById(this.id); sendToServerEncrypted('itemCountSelectorSelected', { id: " + id + ", state: parseInt(nSelection.options[nSelection.selectedIndex].value) } );") ];
}

function createDueDateElement(header, id, value) {
	var selectorElement = [];
	if(header) { selectorElement.push(framework.createUiTextNode("due date", "Eräpäivä")); }
	selectorElement.push(framework.createUiSelectionList("sel", ["heti", "1 viikko", "2 viikkoa", "3 viikkoa", "4 viikkoa" ],
							     value, true, false, false,
							     "var nSelection = document.getElementById(this.id); sendToServerEncrypted('itemCountSelectorSelected', { id: " + id + ", state: nSelection.options[nSelection.selectedIndex].item } );"));
	return selectorElement;
}

function createPreviewLink(id, value) {
    return [ framework.createUiHtmlCell("", "<a href=#>preview</a>", "#ffffff", !value,
					"sendToServerEncrypted('linkClicked', { id: " + id + " } );") ];
}


// Administration UI panel requires application to provide needed priviliges

function createAdminPanelUserPriviliges() {
    return [ { privilige: "view", code: "v" },
	     { privilige: "customer-edit", code: "ce"},
	     { privilige: "invoice-edit", code: "ie"},
	     { privilige: "email-send", code: "e"} ];
}


// No default priviliges needed for self-created users.

function createDefaultPriviliges() {
    return [ ];
}


// Define the top button panel, always visible.
// The panel automatically contains "Logout" and "Admin Mode" buttons so no need to include those.

function createTopButtonList(cookie) {
    return [ { button: { text: "Muokkaa Asiakkaita", callbackMessage: "getCustomersDataForEdit" },
	       priviliges: [ "customer-edit" ] },
	     { button: { text: "Muokkaa Laskupohjia", callbackMessage: "getInvoicesForEdit" },
	       priviliges: [ "invoice-edit" ] } ];
}


// Main UI panel, list of customers and invoices

function processResetToMainState(cookie, content) {
    // this shows up the first UI panel when uses login succeeds or other panels send "OK" / "Cancel" 
    framework.servicelog("User session reset to main state");
    cookie.user = datastorage.read("users").users.filter(function(u) {
	return u.username === cookie.user.username;
    })[0];
    sendCustomersMainData(cookie);
}

var mainDataVisibilityMap = [];
var mainDataSelectionMap = [];
var mainInvoiceMap = [];

function sendCustomersMainData(cookie) {
//    framework.servicelog("My own cookie is: " + util.inspect(cookie));
    var sendable;
    var topButtonList = framework.createTopButtons(cookie, [ { button: { text: "Help",
									 callbackMessage: "getMainHelp" } } ]);
    var customers = [];
    getApplicationData(cookie).teams.forEach(function(t) {
	customers = customers.concat(getCustomersByCompany(t));
    });
    var invoices = [];
    datastorage.read("invoices").invoices.forEach(function(i) {
	if(i.user === cookie.user.username) { invoices.push(i); }
    });

    if(mainDataVisibilityMap.length === 0) {
	var count = 0
	while(count < customers.length * 8 + 8) {
	    mainDataVisibilityMap.push(false);
	    if(((count+2) % 8) === 0) { mainDataSelectionMap.push("Heti"); }
	    else { mainDataSelectionMap.push(1); }
	    count++;
	}
	count = 0;
	while(count < 7) {
	    mainInvoiceMap.push(false);
	    count++;
	}
    }

    var customerList = { title: "Pelaajat",
			 frameId: 0,
			 header: fillHeaderRows(customers, mainDataVisibilityMap, mainDataSelectionMap),
			 items: fillCustomerRows(customers, mainDataVisibilityMap, mainDataSelectionMap) };

    var invoiceList = { title: "Laskupohjat",
			frameId: 1,
			header: [ [ [ framework.createUiHtmlCell("", "") ], [ framework.createUiHtmlCell("", "") ] ] ],
			items: createInvoiceTable(invoices, mainInvoiceMap) };

    var frameList = [ { frameType: "fixedListFrame", frame: customerList },
		      { frameType: "fixedListFrame", frame: invoiceList } ];

    sendable = { type: "createUiPage",
		 content: { topButtonList: topButtonList,
			    frameList: frameList } };

    framework.sendCipherTextToClient(cookie, sendable);
    framework.servicelog("Sent NEW customerMainData to client #" + cookie.count);
}

function fillHeaderRows(customers, vMap, sMap) {
    items = [ [ [ framework.createUiHtmlCell("", "") ], [ framework.createUiHtmlCell("", "") ],
		createClickerElement(0, vMap[0], sMap[0]), createClickerElement(1, vMap[1], sMap[1]), createClickerElement(2, vMap[2], sMap[2]),
		createClickerElement(3, vMap[3], sMap[3]), createClickerElement(4, vMap[4], sMap[4]), createClickerElement(5, vMap[5], sMap[5]),
		createDueDateElement(true, 6, sMap[6]), [ framework.createUiHtmlCell("", "") ] ] ];
    return items;
}

function createInvoiceTable(invoices, iMap) {
    var items = [];
    var count = 1;
    while(count < 7) {
	items.push([ [ framework.createUiTextNode("number", count) ],
		     [ framework.createUiSelectionList("sel", invoices.map(function(i) { return i.description; }), iMap[count], true, false, true,
						       "var nSelection = document.getElementById(this.id); sendToServerEncrypted('invoiceSelectorSelected', { id: " + count + ", state: nSelection.options[nSelection.selectedIndex].item })") ] ] );
	count ++;
    }
    return items;
}

function fillCustomerRows(customers, vMap, sMap) {
    var count = 8
    var items = [];
    customers.forEach(function(c) {
	items.push( [ [ framework.createUiTextNode("name", c.name) ],  [ framework.createUiTextNode("team", c.team) ],
		      createClickerElement(count, vMap[count], sMap[count++]), createClickerElement(count, vMap[count], sMap[count++]),
		      createClickerElement(count, vMap[count], sMap[count++]), createClickerElement(count, vMap[count], sMap[count++]),
		      createClickerElement(count, vMap[count], sMap[count++]), createClickerElement(count, vMap[count], sMap[count++]),
		      createDueDateElement(false, count, sMap[count++]), createPreviewLink((count-7)/8, vMap[count++]),
		      [ framework.createUiHtmlCell("", "") ] ] );
    });
    return items;
}

function processItemCountSelectorClicked(cookie, content) {
    mainDataVisibilityMap[content.id] = content.state;
    if(content.id < 7) {
	var count = content.id + 8;
	while(count < mainDataVisibilityMap.length) {
	    mainDataVisibilityMap[count] = content.state;
	    count = count + 8;
	}
    }
    togglePreviewLinkVisibility();
    sendCustomersMainData(cookie);
}

function processItemCountSelectorSelected(cookie, content) {
    mainDataSelectionMap[content.id] = content.state;
    if(content.id < 7) {
	var count = content.id + 8;
	while(count < mainDataSelectionMap.length) {
	    mainDataSelectionMap[count] = content.state;
	    count = count + 8;
	}
    }
    sendCustomersMainData(cookie);
}

function togglePreviewLinkVisibility() {
    var row = 1;
    var pos = 0;
    var flag = false;
    while((row * 8 + pos) < mainDataVisibilityMap.length) {
	pos = 0;
	flag = false;
	while(pos < 6) {
	    if(mainDataVisibilityMap[row * 8 + pos] === true) { flag = true; }
	    pos++;
	}
	mainDataVisibilityMap[row * 8 + 7] = flag;
	row++;
    }
}

function processLinkClicked(cookie, content) {
    framework.servicelog("link clicked, id: " + JSON.stringify(content));
    framework.servicelog("map: " + JSON.stringify(mainDataSelectionMap));
}

function processInvoiceSelectorSelected(cookie, content) {
    mainInvoiceMap[content.id] = content.state;
}


// Customers data editing

function processGetCustomersDataForEdit(cookie, content) {
    framework.servicelog("Client #" + cookie.count + " requests customers edit");
    if(framework.userHasPrivilige("customer-edit", cookie.user)) {
	// reset visibility/selection mappings as customers may change...
	mainDataVisibilityMap = []; 
	mainDataSelectionMap = [];
	mainInvoiceMap = [];
	var topButtonList = framework.createTopButtons(cookie);
	var items = [];
	var customers = [];
	var teams = getApplicationData(cookie).teams;
	teams.forEach(function(t) {
	    customers = customers.concat(getCustomersByCompany(t));
	});
	customers.forEach(function(c) {
	    items.push([ [ framework.createUiInputField(c.id, c.name, 15, false) ],
			 [ framework.createUiInputField("address", c.address, 15, false) ],
			 [ framework.createUiInputField("detail", c.detail, 15, false) ],
			 [ framework.createUiInputField("email", c.email, 15, false) ],
			 [ framework.createUiInputField("bankref", c.bankReference, 16, false) ],
			 [ framework.createUiSelectionList("team", teams, c.team, true, false, false) ] ]);
	});

	var itemList = { title: "Customers",
			 frameId: 0,
			 header: [ [ [ framework.createUiHtmlCell("", "") ],
				     [ framework.createUiHtmlCell("", "<b>Name</b>") ],
				     [ framework.createUiHtmlCell("", "<b>Address</b>") ],
				     [ framework.createUiHtmlCell("", "<b>Detail</b>") ],
				     [ framework.createUiHtmlCell("", "<b>Email</b>") ],
				     [ framework.createUiHtmlCell("", "<b>Bank Reference</b>") ],
				     [ framework.createUiHtmlCell("", "<b>Team</b>") ] ] ],
			 items: items,
			 newItem: [ [ framework.createUiInputField("name", "", 15, false) ],
				    [ framework.createUiInputField("address", "", 15, false) ],
				    [ framework.createUiInputField("detail", "", 15, false) ],
				    [ framework.createUiInputField("email", "", 15, false) ],
				    [ framework.createUiInputField("bankref", "", 16, false) ],
				    [ framework.createUiSelectionList("team", teams, 1, true, false, false) ] ] };

	var frameList = [ { frameType: "editListFrame", frame: itemList } ];
	var buttonList = [ { id: 501, text: "OK", callbackMessage: "saveAllCustomersData" },
			   { id: 502, text: "Cancel",  callbackMessage: "resetToMain" } ];

	var sendable = { type: "createUiPage",
			 content: { topButtonList: topButtonList,
				    frameList: frameList,
				    buttonList: buttonList } };
	framework.sendCipherTextToClient(cookie, sendable);
	framework.servicelog("Sent customer data to client #" + cookie.count);
    } else {
 	framework.servicelog("User " + cookie.user.username + " does not have priviliges to edit customers");
	sendCustomersMainData(cookie);
    }
}

function processSaveAllCustomersData(cookie, content) {
    if(framework.userHasPrivilige("customer-edit", cookie.user)) {
	var newCustomers = [];
	var nextId = datastorage.read("customers").nextId;
	content.items[0].frame.forEach(function(c) {
	    var id = c[0][0].key;
	    if(id === "name") { id = nextId++; }
	    newCustomers.push({ id: id,
				name: c[0][0].value,
				address: c[1][0].value,
				detail: c[2][0].value,
				email: c[3][0].value,
				bankReference: c[4][0].value,
				team: c[5][0].selected });
	});
	if(datastorage.write("customers", { nextId: nextId, customers: newCustomers }) === false) {
	    framework.servicelog("Updating customers database failed");
	} else {
	    framework.servicelog("Updated customers database");
	}
    } else {
 	framework.servicelog("User " + cookie.user.username + " does not have priviliges to edit customers");
    }
    sendCustomersMainData(cookie);
}


// Invoice data editing

function processGetInvoicesForEdit(cookie, content) {
    framework.servicelog("Client #" + cookie.count + " requests invoices edit");
    if(framework.userHasPrivilige("invoice-edit", cookie.user)) {
	var topButtonList = framework.createTopButtons(cookie);
	var items = [];
	var invoices = [];
	datastorage.read("invoices").invoices.forEach(function(i) {
	    if(i.user === cookie.user.username) { invoices.push(i); }
	});
	invoices.forEach(function(i) {
	    items.push([ [ framework.createUiInputField(i.id, i.description, 15, false) ],
			 [ framework.createUiInputField("price", i.price, 15, false) ],
			 [ framework.createUiInputField("vat", i.vat, 15, false) ] ]);
	});

	var itemList = { title: "Invoices",
			 frameId: 0,
			 header: [ [ [ framework.createUiHtmlCell("", "") ],
				     [ framework.createUiHtmlCell("", "<b>Item</b>") ],
				     [ framework.createUiHtmlCell("", "<b>Price w/o taxes</b>") ],
				     [ framework.createUiHtmlCell("", "<b>Vat %</b>") ] ] ],
			 items: items,
			 newItem: [ [ framework.createUiInputField("description", "", 15, false) ],
				    [ framework.createUiInputField("price", "", 15, false) ],
				    [ framework.createUiInputField("vat", "", 15, false) ] ] };

	var frameList = [ { frameType: "editListFrame", frame: itemList } ];
	var buttonList = [ { id: 501, text: "OK", callbackMessage: "saveAllInvoiceData" },
			   { id: 502, text: "Cancel",  callbackMessage: "resetToMain" } ];

	var sendable = { type: "createUiPage",
			 content: { topButtonList: topButtonList,
				    frameList: frameList,
				    buttonList: buttonList } };
	framework.sendCipherTextToClient(cookie, sendable);
	framework.servicelog("Sent invoice data to client #" + cookie.count);
    } else {
 	framework.servicelog("User " + cookie.user.username + " does not have priviliges to edit invoices");
	sendCustomersMainData(cookie);
    }
}

function processSaveAllInvoiceData(cookie, content) {
    if(framework.userHasPrivilige("invoice-edit", cookie.user)) {
	var newInvoices = [];
	var nextId = datastorage.read("invoices").nextId;
	content.items[0].frame.forEach(function(i) {
	    var id = i[0][0].key;
	    if(id === "description") { id = nextId++; }
	    newInvoices.push({ id: id,
			       description: i[0][0].value,
			       price: i[1][0].value,
			       vat: i[2][0].value,
			       user: cookie.user.username });
	});
	var allInvoices = [];
	datastorage.read("invoices").invoices.forEach(function(i) {
	    if(i.user !== cookie.user.username) { allInvoices.push(i); }
	});
	allInvoices = allInvoices.concat(newInvoices);
	if(datastorage.write("invoices", { nextId: nextId, invoices: allInvoices }) === false) {
	    framework.servicelog("Updating invoice database failed");
	} else {
	    framework.servicelog("Updated invoice database");
	}
    } else {
 	framework.servicelog("User " + cookie.user.username + " does not have priviliges to edit invoices");
    }
    sendCustomersMainData(cookie);
}







function getNiceDate(date) {
    return date.getDate() + "." + (date.getMonth()+1) + "." + date.getFullYear();
}

function getniceDateTime(date) {
    return (date.getDate().toString() + (date.getMonth()+1).toString() + date.getFullYear().toString() +
	    date.getHours().toString() + date.getMinutes().toString());
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
	printLanguageVariable("HELPTEXT_USER_D", language) + "\n" +
	printLanguageVariable("UI_TEXT_LOGIN_A", language) + "\n" +
	printLanguageVariable("UI_TEXT_LOGIN_B", language) + "\n" +
	printLanguageVariable("UI_TEXT_LOGIN_C", language) + "\n" +
	printLanguageVariable("UI_TEXT_LOGIN_D", language) + "\n" +
	printLanguageVariable("UI_TEXT_LOGIN_E", language) + "\n" +
	printLanguageVariable("UI_TEXT_EMAIL_A", language) + "\n" +
	printLanguageVariable("UI_TEXT_EMAIL_B", language) + "\n" +
	printLanguageVariable("UI_TEXT_EMAIL_C", language) + "\n" +
	printLanguageVariable("UI_TEXT_EMAIL_D", language) + "\n" +
	printLanguageVariable("UI_TEXT_EMAIL_E", language) + "\n" +
	printLanguageVariable("UI_TEXT_CONFIG_A", language) + "\n" +
	printLanguageVariable("UI_TEXT_CONFIG_B", language) + "\n" +
	printLanguageVariable("UI_TEXT_CONFIG_C", language) + "\n" +
	printLanguageVariable("UI_TEXT_CONFIG_D", language) + "\n" +
	printLanguageVariable("UI_TEXT_CONFIG_E", language) + "\n" +
	printLanguageVariable("UI_TEXT_CONFIG_F", language) + "\n" +
	printLanguageVariable("UI_TEXT_CONFIG_G", language) + "\n" +
	printLanguageVariable("UI_TEXT_CONFIG_H", language) + "\n" +
	printLanguageVariable("UI_TEXT_CONFIG_I", language) + "\n" +
	printLanguageVariable("UI_TEXT_CONFIG_J", language) + "\n" +
	printLanguageVariable("UI_TEXT_MAIN_A", language) + "\n" +
	printLanguageVariable("UI_TEXT_MAIN_B", language) + "\n" +
	printLanguageVariable("UI_TEXT_MAIN_C", language) + "\n" +
	printLanguageVariable("UI_TEXT_MAIN_D", language) + "\n" +
	printLanguageVariable("UI_TEXT_MAIN_E", language) + "\n" +
	printLanguageVariable("UI_TEXT_MAIN_F", language) + "\n" +
	printLanguageVariable("UI_TEXT_MAIN_G", language) + "\n" +
	printLanguageVariable("UI_TEXT_MAIN_H", language) + "\n" +
	printLanguageVariable("UI_TEXT_MAIN_I", language) + "\n" +
	printLanguageVariable("UI_TEXT_MAIN_J", language) + "\n" +
	printLanguageVariable("UI_TEXT_MAIN_K", language) + "\n" +
	printLanguageVariable("UI_TEXT_MAIN_L", language) + "\n" +
	printLanguageVariable("UI_TEXT_MAIN_M", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_CUSTOMER_A", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_CUSTOMER_B", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_CUSTOMER_C", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_CUSTOMER_D", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_CUSTOMER_E", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_CUSTOMER_F", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_CUSTOMER_G", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_CUSTOMER_H", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_CUSTOMER_I", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_CUSTOMER_J", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_INVOICE_A", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_INVOICE_B", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_INVOICE_C", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_INVOICE_D", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_INVOICE_E", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_INVOICE_F", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_INVOICE_G", language) + "\n" +
	printLanguageVariable("UI_TEXT_EDIT_INVOICE_H", language) + "\n" +
	printLanguageVariable("UI_TEXT_ALERT_A", language) + "\n" +
	printLanguageVariable("UI_TEXT_ALERT_B", language) + "\n" +
	printLanguageVariable("UI_TEXT_ALERT_C", language) + "\n" +
	printLanguageVariable("UI_TEXT_ALERT_D", language) + "\n" +
	printLanguageVariable("UI_TEXT_ALERT_E", language) + "\n\n";
}


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
	    sendable = { type: "unpriviligedLogin",
			 content: getLanguageText(mainConfig.main.language, "HELPTEXT_UNPRIVILIGED_A") };

	    sendCipherTextToClient(cookie, sendable);
	    servicelog("Sent unpriviligedLogin info to client #" + cookie.count);
	} else {
	    cookie.invoiceData = createUserInvoiceData(cookie.user);
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


function processSaveCustomerList(cookie, content) {
    var sendable;
    var invoiceData = JSON.parse(Aes.Ctr.decrypt(content, cookie.user.password, 128));
    servicelog("Client #" + cookie.count + " requests customer list saving: " + JSON.stringify(invoiceData.customers));
    if(userHasCustomerEditPrivilige(cookie.user)) {
	updateCustomersFromClient(cookie, invoiceData.customers);
	cookie.invoiceData = createUserInvoiceData(cookie.user);
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
	cookie.invoiceData = createUserInvoiceData(cookie.user);
    } else {
	servicelog("user has insufficent priviliges to edit invoice tables");
    }
    sendable = { type: "invoiceData", content: cookie.invoiceData };
    sendCipherTextToClient(cookie, sendable);
    servicelog("Sent invoiceData to client #" + cookie.count);
}

function processSaveAdminData(cookie, content) {
    var sendable;
    var adminData = JSON.parse(Aes.Ctr.decrypt(content, cookie.user.password, 128));
    servicelog("Client #" + cookie.count + " requests admin data saving: " + JSON.stringify(adminData));
    if(userHasSysAdminPrivilige(cookie.user)) {
	updateAdminDataFromClient(cookie, adminData);
	cookie.user = getUserByUserName(cookie.user.username)[0];
	cookie.invoiceData = createUserInvoiceData(cookie.user);
    } else {
	servicelog("user has insufficent priviliges to edit admin data");
    }
    sendable = { type: "invoiceData", content: cookie.invoiceData };
    sendCipherTextToClient(cookie, sendable);
    servicelog("Sent invoiceData to client #" + cookie.count);
}

function processPdfPreview(cookie, content) {
    var previewData = JSON.parse(Aes.Ctr.decrypt(content, cookie.user.password, 128));
    servicelog("Client #" + cookie.count + " requests PDF preview " + JSON.stringify(previewData));
    setStatustoClient(cookie, "Printing preview");
    printPreview(pushPreviewToClient, cookie, previewData);
}

function processSendInvoices(cookie, content) {
    cookie.sentMailList = [];
    var invoiceData = JSON.parse(Aes.Ctr.decrypt(content, cookie.user.password, 128));
    servicelog("Client #" + cookie.count + " requests bulk mailing " + JSON.stringify(invoiceData));
    if(userHasSendEmailPrivilige(cookie.user)) {
	setStatustoClient(cookie, "Sending bulk email");
	saveEmailText(cookie, invoiceData.emailText);
	sendBulkEmail(cookie, invoiceData);
    } else {
	servicelog("user has insufficent priviliges to send email");
	setStatustoClient(cookie, "Cannot send email!");
    }
}

function processDownloadInvoices(cookie, content) {
    cookie.sentMailList = [];
    var invoiceData = JSON.parse(Aes.Ctr.decrypt(content, cookie.user.password, 128));
    servicelog("Client #" + cookie.count + " requests invoice downloading " + JSON.stringify(invoiceData));
    setStatustoClient(cookie, "Downloading invoices");
    downloadInvoicesToClient(cookie, invoiceData);
}

function processAdminMode(cookie, content) {
    servicelog("Client #" + cookie.count + " requests Sytem Administration priviliges");
    if(userHasSysAdminPrivilige(cookie.user)) {
	servicelog("Granted Sytem Administration priviliges to user " + cookie.user.username);
	sendable = { type: "adminData",
		     content: createAdminData(cookie) };
	sendCipherTextToClient(cookie, sendable);
	servicelog("Sent adminData to client #" + cookie.count);
    } else {
	servicelog("user " + cookie.user.username + " does not have Sytem Administration priviliges!");
	processClientStarted(cookie);
    }	
}

function processHelpScreen(cookie, content) {
    var content = JSON.parse(Aes.Ctr.decrypt(content, cookie.user.password, 128));
    servicelog("Client #" + cookie.count + " requests help screen (mode : " + JSON.stringify(content) + " )");
    if(content.mode === "user") {
	sendable = { type: "helpText",
		     content: fs.readFileSync("./" + getLanguageText(mainConfig.main.language, 
								     "HELPFILE_USER"))
		     .toString("base64") };
	sendCipherTextToClient(cookie, sendable);
    } else {
	sendable = { type: "helpText",
		     content: fs.readFileSync("./" + getLanguageText(mainConfig.main.language,
								     "HELPFILE_ADMIN"))
		     .toString("base64") };
	sendCipherTextToClient(cookie, sendable);
    }
}

function printPreview(callback, cookie, previewData)
{
    var filename = "./temp/preview.pdf";
    var now = new Date();

    var invoice = cookie.invoiceData.invoices.map(function(a, b) {
	if(previewData.invoices.map(function(e) {
	    return e.item;
	}).indexOf(b) >= 0) {
	    a.n = previewData.invoices[previewData.invoices.map(function(e) {
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
	if(s.id === cookie.invoiceData.customers[previewData.customer].team) { return s }
    }).filter(function(s){ return s; })[0];

    var bill = { companyName: company.name,
		 companyAddress: company.address,
		 bankName: company.bankName,
		 bic: company.bic,
		 iban: company.iban,
		 customerName: cookie.invoiceData.customers[previewData.customer].name,
		 customerAddress: cookie.invoiceData.customers[previewData.customer].address,
		 customerDetail: cookie.invoiceData.customers[previewData.customer].detail,
		 reference: cookie.invoiceData.customers[previewData.customer].reference,
		 date: getNiceDate(now),
		 number: "",
		 id: "",
		 intrest: "",
		 expireDate: getNiceDate(new Date(now.valueOf()+(60*60*24*1000*previewData.dueDate))),
		 notice: "14 vrk." }

    pdfprinter.printSheet(callback, cookie, {}, filename, bill, invoice, false, false);
    servicelog("Created PDF preview document");
}

function sendBulkEmail(cookie, invoiceData) {
    var now = new Date();
    var billNumber = getniceDateTime(now);
    var customerCount = 0;

    if(invoiceData.invoices.length === 0) {
	servicelog("Invoice empty, not emailing PDF documents");
	setStatustoClient(cookie, "No mailing available");
	return null;
    }

    invoiceData.invoices.forEach(function(currentCustomer) {
	customerCount++;
	var customer = cookie.invoiceData.customers.map(function(a, b) {
	    if(currentCustomer.id === b) { a.dueDate = currentCustomer.dueDate;  return a; }
	}).filter(function(s){ return s; })[0];

	var invoiceRows = cookie.invoiceData.invoices.map(function(a, b) {
	    if(currentCustomer.invoices.map(function(e) {
		return e.item;
	    }).indexOf(b) >= 0) {
		a.n = currentCustomer.invoices[currentCustomer.invoices.map(function(e) {
		    return e.item;
		}).indexOf(b)].count;
		return a;
	    }
	}).filter(function(s){ return s; });

	var company = cookie.invoiceData.company.map(function(s) {
	    if(s.id === cookie.invoiceData.customers[currentCustomer.id].team) { return s }
	}).filter(function(s){ return s; })[0];

	var bill = { companyName: company.name,
		     companyAddress: company.address,
		     bankName: company.bankName,
		     bic: company.bic,
		     iban: company.iban,
		     customerName: customer.name,
		     customerAddress: customer.address,
		     customerDetail: customer.detail,
		     reference: customer.reference,
		     date: getNiceDate(now),
		     number: billNumber,
		     id: "",
		     intrest: "",
		     expireDate: getNiceDate(new Date(now.valueOf()+(60*60*24*1000*customer.dueDate))),
		     notice: "14 vrk." }

	var customerName = customer.name.replace(/\W+/g , "_");
	var filename = "./temp/" + customerName + "_" + billNumber + ".pdf";

	var mailDetails = { text: invoiceData.emailText,
			    from: datastorage.read("email").sender,
			    "reply-to": cookie.user.realname + " <" + cookie.user.email + ">",
			    to:  customer.email,
			    subject: "Uusi lasku " + company.name + " / " + billNumber,
			    attachment: [ { path: filename,
					    type: "application/pdf",
					    name: customer.name.replace(" ", "_") + "_" + billNumber + ".pdf" }]};

	servicelog("invoiceRows: " + JSON.stringify(invoiceRows));

	pdfprinter.printSheet(sendEmail, cookie, mailDetails, filename, bill, invoiceRows, "invoice sending",
			      invoiceData.invoices.length, billNumber);
	servicelog("Sent PDF emails");
    });
}

function downloadInvoicesToClient(cookie, invoiceData) {
    var now = new Date();
    var billNumber = getniceDateTime(now);
    var customerCount = 0;

    if(invoiceData.invoices.length === 0) {
	servicelog("Invoice empty, not downloading PDF documents");
	setStatustoClient(cookie, "No downloading available");
	return null;
    }

    invoiceData.invoices.forEach(function(currentCustomer) {
	customerCount++;
	var customer = cookie.invoiceData.customers.map(function(a, b) {
	    if(currentCustomer.id === b) { a.dueDate = currentCustomer.dueDate;  return a; }
	}).filter(function(s){ return s; })[0];

	var invoiceRows = cookie.invoiceData.invoices.map(function(a, b) {
	    if(currentCustomer.invoices.map(function(e) {
		return e.item;
	    }).indexOf(b) >= 0) {
		a.n = currentCustomer.invoices[currentCustomer.invoices.map(function(e) {
		    return e.item;
		}).indexOf(b)].count;
		return a;
	    }
	}).filter(function(s){ return s; });

	var company = cookie.invoiceData.company.map(function(s) {
	    if(s.id === cookie.invoiceData.customers[currentCustomer.id].team) { return s }
	}).filter(function(s){ return s; })[0];

	var bill = { companyName: company.name,
		     companyAddress: company.address,
		     bankName: company.bankName,
		     bic: company.bic,
		     iban: company.iban,
		     customerName: customer.name,
		     customerAddress: customer.address,
		     customerDetail: customer.detail,
		     reference: customer.reference,
		     date: getNiceDate(now),
		     number: billNumber,
		     id: "",
		     intrest: "",
		     expireDate: getNiceDate(new Date(now.valueOf()+(60*60*24*1000*customer.dueDate))),
		     notice: "14 vrk." }

	var customerName = customer.name.replace(/\W+/g , "_");
	var filename = "./temp/" + customerName + "_" + billNumber + ".pdf";

	servicelog("invoiceRows: " + JSON.stringify(invoiceRows));

	pdfprinter.printSheet(dontSendEmail, cookie, null, filename, bill, invoiceRows, "invoice downloading",
			      invoiceData.invoices.length, billNumber);
	servicelog("Created PDF documents");
    });
}

function pushPreviewToClient(cookie, dummy1, filename, dummy2, dummy3, dummy4) {
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
    servicelog("pushed preview PDF to client");
}

function saveEmailText(cookie, emailText) {
    cookie.user.applicationData.emailText = emailText;
    updateUserdataFromCookie(cookie);
    servicelog("Updated user data with new email text: [" + JSON.stringify(emailText) + "]");
}

function updateUserdataFromCookie(cookie) {
    var userData = readUserData();
    var newUserData = { users: [] };

    newUserData.users = userData.users.filter(function(u) {
	return u.username !== cookie.user.username;
    });
    newUserData.users.push(cookie.user);
    if(datastorage.write("users", newUserData) === false) {
	servicelog("User database write failed");
    } else {
	servicelog("Updated User Account from cookie: " + JSON.stringify(cookie.user));
    }
}

function updateCustomersFromClient(cookie, customers) {
    var customerData = datastorage.read("customers");

    var checkedCustomers = customers.map(function(c) {
	if(cookie.user.applicationData.teams.indexOf(c.team) >= 0) { return c; }
    }).filter(function(s){ return s; });

    var newCustomerData = { customers: [] };
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

function cleanupNumberInput(input) {
    var cleanedNumber = input.replace(/,/g , ".").split(".");
    if(cleanedNumber[1] === undefined) {
	return cleanedNumber[0];
    } else {
	return cleanedNumber[0] + "." + cleanedNumber[1];
    }
}

function updateInvoicesFromClient(cookie, invoices) {
    var invoiceData = datastorage.read("invoices");

    var checkedInvoices = invoices.map(function(c) {
	if(c.user === cookie.user.username) { return c; }
    }).filter(function(s){ return s; });

    checkedInvoices.forEach(function(item) {
	item.price = cleanupNumberInput(item.price);
	item.vat = cleanupNumberInput(item.vat);
    });

    var newInvoiceData = { invoices: [] };
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

function updateAdminDataFromClient(cookie, adminData) {
    if(datastorage.write("users", { users: adminData.users }) === false) {
	servicelog("User database write failed");
    } else {
	servicelog("Updated User database: " + JSON.stringify(adminData.users));
    }
    if(datastorage.write("company", { company: adminData.companies }) === false) {
	servicelog("Company database write failed");
    } else {
	servicelog("Updated Company database: " + JSON.stringify(adminData.companies));
    }
}

function processCreateAccount(cookie, accountDefaults, content) {
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
	if(!createAccount(account, accountDefaults)) {
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
				    from: datastorage.read("email").sender,
				    to: account.email,
				    subject: emailSubject };

	    var mailDetailsAdmin = { text: emailAdminBody,
				     from: datastorage.read("email").sender,
				     to: mainConfig.main.adminEmailAddess,
				     subject: emailAdminSubject };

	    sendEmail(cookie, mailDetailsUser, false, "account creation", false, false);
	    sendEmail(cookie, mailDetailsAdmin, false, "account creation", false, false);

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
	    var user = getUserByEmail(account.email);
	    if(user.length !== 0) {
		newAccount.username = user[0].username;
		newAccount.realname = user[0].realname;
		newAccount.phone = user[0].phone;
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
	var newUserData = { users: [] };
	newUserData.users = userData.users.filter(function(u) {
	    return u.username !== account.username;
	});
	var newUserAccount = { username: account.username,
			       hash: sha1.hash(account.username),
			       password: account.password,
			       applicationData: oldUserAccount[0].applicationData };
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
				from: datastorage.read("email").sender,
				to: account.email,
				subject: emailSubject };

	var mailDetailsAdmin = { text: emailAdminBody,
				 from: datastorage.read("email").sender,
				 to: mainConfig.main.adminEmailAddess,
				 subject: emailAdminSubject };

	sendEmail(cookie, mailDetailsUser, false, "account update", false, false);
	sendEmail(cookie, mailDetailsAdmin, false, "account update", false, false);
	return true;
    }
}

function userHasCustomerEditPrivilige(user) {
    if(user.applicationData.priviliges.length === 0) { return false; }
    if(user.applicationData.priviliges.indexOf("customer-edit") < 0) { return false; }
    return true;
}

function userHasInvoiceEditPrivilige(user) {
    if(user.applicationData.priviliges.length === 0) { return false; }
    if(user.applicationData.priviliges.indexOf("invoice-edit") < 0) { return false; }
    return true;
}

function userHasSendEmailPrivilige(user) {
    if(user.applicationData.priviliges.length === 0) { return false; }
    if(user.applicationData.priviliges.indexOf("email-send") < 0) { return false; }
    return true;
}

function userHasSysAdminPrivilige(user) {
    if(user.applicationData.priviliges.length === 0) { return false; }
    if(user.applicationData.priviliges.indexOf("system-admin") < 0) { return false; }
    return true;
}

function getUserPriviliges(user) {
    if(user.applicationData.priviliges.length === 0) { return []; }
    if(user.applicationData.priviliges.indexOf("none") > -1) { return []; }
    return user.applicationData.priviliges;
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

function createAccount(account, accountDefaults) {
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
			   applicationData: accountDefaults };
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
    var pendingUserData = datastorage.read("pending");
    if(Object.keys(pendingUserData.pending).length === 0) {
	servicelog("Empty pending requests database, bailing out");
	return false;
    } 
    var target = pendingUserData.pending.filter(function(u) {
	return u.token.mail === code.slice(0, 8);
    });
    if(target.length === 0) {
	return false;
    } else {
	var newPendingUserData = { pending: [] };
	newPendingUserData.pending = pendingUserData.pending.filter(function(u) {
	    return u.token.mail !== code.slice(0, 8);
	});

	if(datastorage.write("pending", newPendingUserData) === false) {
	    servicelog("Pending requests database write failed");
	} else {
	    servicelog("Removed pending request from database");
	}
	return target[0];
    }
}

function removePendingRequest(cookie, emailAdress) {
    var pendingUserData = datastorage.read("pending");
    if(Object.keys(pendingUserData.pending).length === 0) {
	servicelog("Empty pending requests database, bailing out");
	return;
    }
    if(pendingUserData.pending.filter(function(u) {
	return u.email === emailAdress;
    }).length !== 0) {
	servicelog("Removing duplicate entry from pending database");
	var newPendingUserData = { pending: [] };
	newPendingUserData.pending = pendingUserData.pending.filter(function(u) {
            return u.email !== emailAdress;
	});
	if(datastorage.write("pending", newPendingUserData) === false) {
            servicelog("Pending requests database write failed");
	}
    } else {
	servicelog("no duplicate entries in pending database");
    }
}

function sendVerificationEmail(cookie, recipientAddress) {
    removePendingRequest(cookie, recipientAddress);
    var pendingData = datastorage.read("pending");
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
			from: datastorage.read("email").sender,
			to: recipientAddress,
			subject: emailSubject };

    sendEmail(cookie, mailDetails, false, "account verification", false, false);
}

function dontSendEmail(cookie, dummy, filename, logline, totalInvoiceCount, billNumber) {
    cookie.sentMailList.push(filename);
    if(cookie.sentMailList.length === totalInvoiceCount) {
	pushSentEmailZipToClient(cookie, billNumber);
    }
}

function sendEmail(cookie, emailDetails, filename, logline, totalEmailCount, billNumber) {
    var emailData = datastorage.read("email");
    if(emailData.blindlyTrust) {
	servicelog("Trusting self-signed certificates");
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

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
		var newFilename =  "./failed_invoices/" + path.basename(filename);
		fs.renameSync(filename, newFilename);
		cookie.sentMailList.push(newFilename);
		if(cookie.sentMailList.length === totalEmailCount) {
		    pushSentEmailZipToClient(cookie, billNumber);
		}
	    }
	} else {
	    servicelog("Sent " + logline + " email to " + emailDetails.to);
	    setStatustoClient(cookie, "Sent email");
	    if(filename) {
		var newFilename =  "./sent_invoices/" + path.basename(filename);
		fs.renameSync(filename, newFilename);
		cookie.sentMailList.push(newFilename);
		if(cookie.sentMailList.length === totalEmailCount) {
		    pushSentEmailZipToClient(cookie, billNumber);
		}
	    }
	}
    });
}

function pushSentEmailZipToClient(cookie, billNumber) {
    var zipFileName = "./temp/invoices_" + billNumber + ".zip"
    var archiveStream = fs.createWriteStream(zipFileName);
    var archive = archiver("zip");
    archive.pipe(archiveStream);
    for(i=0; i<cookie.sentMailList.length; i++) {
	var fileName = cookie.sentMailList[i].replace("./", "");
	archive.append(fs.createReadStream(fileName), { name: fileName });
    }
    archive.finalize();

    archive.on('error', function(err) {
	servicelog("Error creating invoice zipfile: " + JSON.stringify(err));
	return;
    });

    archiveStream.on('close', function() {
	if(!stateIs(cookie, "loggedIn")) {
	    setStatustoClient(cookie, "Login failure");
	    servicelog("Login failure in zipfile sending");
	    return;
	}
	try {
	    var zipFile = fs.readFileSync(zipFileName).toString("base64");
	} catch(err) {
	    servicelog("Failed to load zipfile: " + err);
	    setStatustoClient(cookie, "zipfile load failure!");
	    return;
	}
	var sendable = { type: "zipUpload",
			 content: zipFile };
	sendCipherTextToClient(cookie, sendable);
	servicelog("pushed email zipfile to client");
	setStatustoClient(cookie, "OK");
    });
}

function generateEmailToken(email) {
    return { mail: sha1.hash(email).slice(0, 8),
	     key: sha1.hash(globalSalt + JSON.stringify(new Date().getTime())).slice(0, 16) };
}

function getNewChallenge() {
    return ("challenge_" + sha1.hash(globalSalt + new Date().getTime().toString()) + "1");
}

function createUserInvoiceData(user) {
    var customerData = datastorage.read("customers");
    var invoiceData = datastorage.read("invoices");
    var companyData = datastorage.read("company");

    var ownCustomers = [];
    customerData.customers.forEach(function(customer) {
	if(user.applicationData.teams.indexOf(customer.team) >= 0) {
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
	if(user.applicationData.teams.indexOf(company.id) >= 0) {
	    ownCompany.push(company);
	}
    });

    ownCustomers = sortByKey(ownCustomers, "name");
    return { customers: ownCustomers,
	     invoices: ownInvoices,
	     company: ownCompany,
	     emailText: user.applicationData.emailText,
	     user: user.username,
	     teams: user.applicationData.teams,
	     priviliges: user.applicationData.priviliges };
}

function createAdminData(cookie) {
    return { users: datastorage.read("users").users,
	     companies: datastorage.read("company").company };
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
    var pendingUserData = datastorage.read("pending");
    if(Object.keys(pendingUserData.pending).length === 0) {
	servicelog("No pending requests to purge");
	return;
    }
    
    var purgeCount = 0
    var newPendingUserData = { pending: [] };
    pendingUserData.pending.forEach(function(r) {
	if(r.date < now) {
	    purgeCount++;
	} else {
	    newPendingUserData.pending.push(r);
	}
    });

    if(purgeCount === 0) {
	servicelog("No pending requests timeouted");
	return;
    } else {
	if(datastorage.write("pending", newPendingUserData) === false) {
	    servicelog("Pending requests database write failed");
	} else {
	    servicelog("Removed " + purgeCount + " timeouted pending requests");
	}
    }
}, 1000*60*60);


// database conversion and update

function updateDatabaseVersionTo_1() {
    var newItems = [];
    var nextId = 1;
    datastorage.read("company").company.forEach(function(c) {
	newItems.push({ id: nextId++,
			name: c.name,
			shortName: c.id,
			address: c.address,
			bankName: c.bankName,
			bic: c.bic,
			iban: c.iban });
    });
    if(datastorage.write("company", { nextId: nextId, company: newItems }) === false) {
	framework.servicelog("Updating company database failed");
	process.exit(1);
    } else {
	framework.servicelog("Updated company database to v.1");
    }
    newItems = [];
    nextId = 1;
    datastorage.read("invoices").invoices.forEach(function(i) {
	newItems.push({ id: nextId++,
			description: i.description,
			price: i.price,
			user: i.user,
			vat: i.vat });
    });
    if(datastorage.write("invoices", { nextId: nextId, invoices: newItems }) === false) {
	framework.servicelog("Updating invoices database failed");
	process.exit(1);
    } else {
	framework.servicelog("Updated invoices database to v.1");
    }
    newItems = [];
    nextId = 1;
    datastorage.read("customers").customers.forEach(function(c) {
	newItems.push({ id: nextId++,
			name: c.name,
			address: c.address, 
			detail: c.detail, 
			email: c.email,  
			bankReference: c.reference, 
			team: c.team });
    });
    if(datastorage.write("customers", { nextId: nextId, customers: newItems }) === false) {
	framework.servicelog("Updating customers database failed");
	process.exit(1);
    } else {
	framework.servicelog("Updated customers database to v.1");
    }
    var mainConfig = datastorage.read("main").main;
    mainConfig.version = 1;
    if(datastorage.write("main", { main: mainConfig }) === false) {
	framework.servicelog("Updating main database failed");
	process.exit(1);
    } else {
	framework.servicelog("Updated main database to v.1");
    }
}


// Create needed directories

if (!fs.existsSync("./temp/")){ fs.mkdirSync("./temp/"); }
if (!fs.existsSync("./sent_invoices/")){ fs.mkdirSync("./sent_invoices/"); }
if (!fs.existsSync("./failed_invoices/")){ fs.mkdirSync("./failed_invoices/"); }


// Initialize application-specific datastorages

function initializeDataStorages() {
    framework.initializeDataStorages();

    datastorage.initialize("customers", { customers: [] }, true);
    datastorage.initialize("invoices", { invoices: [] }, true);
    datastorage.initialize("company", { company: [] }, true);

    var mainConfig = datastorage.read("main").main;

    if(mainConfig.version === undefined) { mainConfig.version = 0; }
    if(mainConfig.version > databaseVersion) {
	framework.servicelog("Database version is too high for this program release, please update program.");
	process.exit(1);
    }
    if(mainConfig.version < databaseVersion) {
	framework.servicelog("Updating database version to most recent supported by this program release.");
	if(mainConfig.version === 0) {
	    // update database version from 0 to 1
	    updateDatabaseVersionTo_1();
	}
    }
}


// Push callbacks to framework

framework.setCallback("datastorageRead", datastorage.read);
framework.setCallback("datastorageWrite", datastorage.write);
framework.setCallback("datastorageInitialize", datastorage.initialize);
framework.setCallback("handleApplicationMessage", handleApplicationMessage);
framework.setCallback("processResetToMainState", processResetToMainState);
framework.setCallback("createAdminPanelUserPriviliges", createAdminPanelUserPriviliges);
framework.setCallback("createDefaultPriviliges", createDefaultPriviliges);
framework.setCallback("createTopButtonList", createTopButtonList);


// Start the web interface

initializeDataStorages();
framework.setApplicationName("Pantterilasku");
framework.startUiLoop();

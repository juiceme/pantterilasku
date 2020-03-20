var fw = require("./framework/framework.js");
var fs = require("fs");
var email = require("emailjs/email");
var pdfprinter = require("./pdfprinter");
var path = require("path");
var ds = require('./datastorage/datastorage.js');
var archiver = require("archiver");
var util = require('util')

var databaseVersion = 1;


// Application specific part starts from here

function handleApplicationMessage(cookie, decryptedMessage) {

//    fw.servicelog("Got message: " + JSON.stringify(decryptedMessage));

    if(decryptedMessage.type === "resetToMain") {
	processResetToMainState(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "getCompanyDataForEdit") {
	processGetCompanyDataForEdit(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "getCustomerDataForEdit") {
	processGetcustomerDataForEdit(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "getInvoicesForEdit") {
	processGetInvoicesForEdit(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "getArchiveForEdit") {
	processGetArchiveForEdit(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "itemCountSelectorClicked") {
	processItemCountSelectorClicked(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "itemCountSelectorSelected") {
	processItemCountSelectorSelected(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "previewLinkClicked") {
	processLinkClicked(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "invoiceSelectorSelected") {
	processInvoiceSelectorSelected(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "saveAllCompanyData") {
	processSaveAllCompanyData(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "saveCustomerData") {
	processSaveCustomerData(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "saveAllInvoiceData") {
	processSaveAllInvoiceData(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "sendInvoicesByEmail") {
	processSendInvoicesByEmail(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "downloadInvoices") {
	processDownloadInvoices(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "downloadArchived") {
	processDownloadArchived(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "deleteArchived") {
	processDeleteArchived(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "confirmResponse") {
	if(decryptedMessage.content.confirmId === "confirm_email_sending") {
	    processConfirmedEmailSending(cookie, decryptedMessage.content);
	} else {
	    fw.servicelog("Received undefined confirm response");
	}
    }
}


// helpers

function getCompany(cookie) {
    return ds.read("access").access.map(function(a) {
	if(a.username === cookie.user.username) {
	    return a.company;
	}
    }).filter(function(f){ return f; })[0].split(',');
}

function getCompanyCustomers(company) {
    var customers = [];
    ds.read("customers").customers.forEach(function(c) {
	if(c.company === company) { customers.push(c); }
    });
    return customers;
}

function createClickerElement(id, state, value) {
    return [ fw.createUiCheckBox("tick", state, "tick", true,
				 "sendToServerEncrypted('itemCountSelectorClicked', { id: " + id + ", state: document.getElementById(this.id).checked } );"),
	     fw.createUiSelectionList("sel", [1,2,3,4,5,6,7,8,9], value, true, !state, false,
				      "var nSelection = document.getElementById(this.id); sendToServerEncrypted('itemCountSelectorSelected', { id: " + id + ", state: parseInt(nSelection.options[nSelection.selectedIndex].value) } );") ];
}

function createDueDateElement(header, id, value) {
    var selectorElement = [];
    if(header) { selectorElement.push(fw.createUiTextNode("due date", "Eräpäivä")); }
    selectorElement.push(fw.createUiSelectionList("sel", ["heti", "1 viikko", "2 viikkoa", "3 viikkoa", "4 viikkoa" ],
						  value, true, false, false,
						  "var nSelection = document.getElementById(this.id); sendToServerEncrypted('itemCountSelectorSelected', { id: " + id + ", state: nSelection.options[nSelection.selectedIndex].item } );"));
    return selectorElement;
}

function createPreviewLink(count, id, value) {
    return [ fw.createUiHtmlCell("", "<a href=#>preview</a>", "#ffffff", !value,
				 "sendToServerEncrypted('previewLinkClicked', { count: " + count + ", id: " + id + " } );") ];
}


// Administration UI panel requires application to provide needed priviliges

function createAdminPanelUserPriviliges() {
    return [ { privilige: "view", code: "v" },
	     { privilige: "archive-edit", code: "ar"},
	     { privilige: "company-edit", code: "co"},
	     { privilige: "customer-edit", code: "cu"},
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
    return [ { button: { text: "Muokkaa Joukkueita", callbackMessage: "getCompanyDataForEdit" },
	       priviliges: [ "company-edit" ] },
	     { button: { text: "Muokkaa Pelaajia", callbackMessage: "getCustomerDataForEdit" },
	       priviliges: [ "customer-edit" ] },
	     { button: { text: "Muokkaa Laskupohjia", callbackMessage: "getInvoicesForEdit" },
	       priviliges: [ "invoice-edit" ] },
	     { button: { text: "Arkisto", callbackMessage: "getArchiveForEdit" },
	       priviliges: [ "archive-edit" ] } ];
}


// Main UI panel, list of customers and invoices

function processResetToMainState(cookie, content) {
    // this shows up the first UI panel when uses login succeeds or other panels send "OK" / "Cancel"
    scrollScreenToTop(cookie)
    mainDataVisibilityMap = [];
    mainDataSelectionMap = [];
    mainInvoiceMap = [];
    fw.servicelog("User session reset to main state");
    cookie.user = ds.read("users").users.filter(function(u) {
	return u.username === cookie.user.username;
    })[0];
    sendMainInvoicingPanel(cookie);
}

var mainDataVisibilityMap = [];
var mainDataSelectionMap = [];
var mainInvoiceMap = [];

function sendMainInvoicingPanel(cookie) {
//    fw.servicelog("My own cookie is: " + util.inspect(cookie));
    var sendable;
    var topButtonList = fw.createTopButtons(cookie, [ { button: { text: "Help",
								  callbackMessage: "getMainHelp" } } ]);
    var customers = [];
    company = getCompany(cookie);
    if(company.length !== 0) {
	company.forEach(function(c) {
	    customers = customers.concat(getCompanyCustomers(c));
	});
    }
    var invoices = [];
    ds.read("invoices").invoices.forEach(function(i) {
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

    var emailText = ds.read("access").access.map(function(a) {
	if(a.username === cookie.user.username) { return a.emailText; }
    }).filter(function(f){ return f; })[0];

    var customerList = { title: "Pelaajat",
		       frameId: 0,
		       header: fillHeaderRows(customers, mainDataVisibilityMap, mainDataSelectionMap),
		       items: fillCustomerRows(customers, mainDataVisibilityMap, mainDataSelectionMap) };

    var invoiceList = { title: "Laskupohjat",
			frameId: 1,
			header: [ [ [ fw.createUiHtmlCell("", "") ], [ fw.createUiHtmlCell("", "") ] ] ],
			items: createInvoiceTable(invoices, mainInvoiceMap) };

    var emailList = { title: "Sähköpostin saateteksti",
		      frameId: 2,
		      header: [ [] ],
		      items: [ [ [ fw.createUiTextArea("emailText", emailText, 80, 5) ] ] ] };

    var buttonList = [ { id: 501, text: "Lähetä laskut sähköpostilla!", callbackMessage: "sendInvoicesByEmail" },
		       { id: 502, text: "Lataa laskut zippitiedostona",  callbackMessage: "downloadInvoices" } ];

    var frameList = [ { frameType: "fixedListFrame", frame: customerList },
		      { frameType: "fixedListFrame", frame: invoiceList },
		      { frameType: "fixedListFrame", frame: emailList } ];

    sendable = { type: "createUiPage",
		 content: { topButtonList: topButtonList,
			    frameList: frameList,
			    buttonList: buttonList } };

    fw.sendCipherTextToClient(cookie, sendable);
}

function fillHeaderRows(customers, vMap, sMap) {
    items = [ [ [ fw.createUiHtmlCell("", "") ], [ fw.createUiHtmlCell("", "") ],
		createClickerElement(0, vMap[0], sMap[0]), createClickerElement(1, vMap[1], sMap[1]), createClickerElement(2, vMap[2], sMap[2]),
		createClickerElement(3, vMap[3], sMap[3]), createClickerElement(4, vMap[4], sMap[4]), createClickerElement(5, vMap[5], sMap[5]),
		createDueDateElement(true, 6, sMap[6]), [ fw.createUiHtmlCell("", "") ] ] ];
    return items;
}

function createInvoiceTable(invoices, iMap) {
    var items = [];
    var count = 1;
    while(count < 7) {
	items.push([ [ fw.createUiTextNode("number", count) ],
		     [ fw.createUiSelectionList("sel", invoices.map(function(i) { return i.id + ". " + i.description; }), iMap[count], true, false, true,
						"var nSelection = document.getElementById(this.id); sendToServerEncrypted('invoiceSelectorSelected', { id: " + count + ", state: nSelection.options[nSelection.selectedIndex].item })") ] ] );
	count ++;
    }
    return items;
}

function fillCustomerRows(customers, vMap, sMap) {
    var count = 8
    var items = [];
    customers.forEach(function(c) {
	items.push( [ [ fw.createUiTextNode(c.id, c.name) ],  [ fw.createUiTextNode("company", c.company) ],
		      createClickerElement(count, vMap[count], sMap[count++]), createClickerElement(count, vMap[count], sMap[count++]),
		      createClickerElement(count, vMap[count], sMap[count++]), createClickerElement(count, vMap[count], sMap[count++]),
		      createClickerElement(count, vMap[count], sMap[count++]), createClickerElement(count, vMap[count], sMap[count++]),
		      createDueDateElement(false, count, sMap[count++]), createPreviewLink((count-7)/8, c.id, vMap[count++]),
		      [ fw.createUiHtmlCell("", "") ] ] );
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
    sendMainInvoicingPanel(cookie);
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
    sendMainInvoicingPanel(cookie);
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
    var items = mainDataVisibilityMap.slice(content.count * 8, content.count * 8 + 6).map(function(s, n) {
	if(s) { return { item: mainInvoiceMap[n + 1],
			 count: mainDataSelectionMap.slice(content.count * 8, content.count * 8 + 6)[n] }; }
	else { return false; }
    }).filter(function(f){ return f; });
    var dueDays = dueDateToDays(mainDataSelectionMap.slice(content.count * 8, content.count * 8 + 7)[6])
    var customer = ds.read("customers").customers.map(function(q) {
	if(q.id === content.id) { return q; }
    }).filter(function(f){ return f; })[0];
    var company = ds.read("company").company.map(function(t) {
	if(customer.company === t.color) { return t; }
    }).filter(function(f){ return f; })[0];
    var invoice = [];
    items.forEach(function(i) {
	invoice.push(ds.read("invoices").invoices.map(function(j) {
	    if(j.id === parseInt(i.item.split('.')[0])) {
		return { item: j,
			 count: i.count };
	    }
	}).filter(function(f){ return f; })[0]);
    });
    if(invoice.length == 0) {
	servicelog("Invoice empty, not creating PDF preview document");
	setStatustoClient(cookie, "No preview available");
	return;
    }
    var now = new Date();
    var billNumber = getniceDateTime(now);
    var dueDate = getNiceDate(new Date(now.valueOf()+(60*60*24*1000*dueDays)));
    fw.setStatustoClient(cookie, "Printing preview");
    createPdfInvoice(cookie, billNumber++, customer, company, invoice, dueDate, "", 0, pushPreviewToClient)
}

function processInvoiceSelectorSelected(cookie, content) {
    mainInvoiceMap[content.id] = content.state;
}


// Company data editing

function processGetCompanyDataForEdit(cookie, content) {
    fw.servicelog("Client #" + cookie.count + " requests company edit");
    if(fw.userHasPrivilige("company-edit", cookie.user)) {
	var topButtonList = fw.createTopButtons(cookie);
	var users = [];
	var access = ds.read("access").access;
	ds.read("users").users.forEach(function(u) {
	    users.push({ user: u.username,
			 company: access.map(function(a) {
			     if(u.username === a.username) { return a.company; }
			 }).filter(function(f){ return f; }),
			 emailText: access.map(function(a) {
			     if(u.username === a.username) { return a.emailText; }
			 }).filter(function(f){ return f; })
		       });
	});
	var userItems = [];
	users.forEach(function(u) {
	    userItems.push([ [ fw.createUiTextNode("username", u.user) ],
			     [ fw.createUiInputField("company", u.company, 15, false) ],
			     [ fw.createUiInputField("company", u.emailText, 35, false) ] ]);
	});
	var userItemList = { title: "Users",
			     frameId: 0,
			     header: [ [ [ fw.createUiHtmlCell("", "<b>User</b>") ],
				       [ fw.createUiHtmlCell("", "<b>Company colors</b>") ] ] ],
			     items: userItems };
	var companyItems = [];
	ds.read("company").company.forEach(function(t) {
	    companyItems.push([ [ fw.createUiInputField(t.id, t.color, 15, false) ],
			     [ fw.createUiInputField("name", t.name, 15, false) ],
			     [ fw.createUiInputField("address", t.address, 15, false) ],
			     [ fw.createUiInputField("bank", t.bank, 15, false) ],
			     [ fw.createUiInputField("iban", t.iban, 15, false) ],
			     [ fw.createUiInputField("bic", t.bic, 15, false) ] ]);
	});
	var companyItemList = { title: "Company",
			     frameId: 1,
			     header: [ [ [ fw.createUiHtmlCell("", "") ],
					 [ fw.createUiHtmlCell("", "<b>Color</b>") ],
					 [ fw.createUiHtmlCell("", "<b>Name</b>") ],
					 [ fw.createUiHtmlCell("", "<b>Address</b>") ],
					 [ fw.createUiHtmlCell("", "<b>Bank</b>") ],
					 [ fw.createUiHtmlCell("", "<b>IBAN</b>") ],
					 [ fw.createUiHtmlCell("", "<b>BIC</b>") ] ] ],
			     items: companyItems,
			     newItem: [ [ fw.createUiInputField("color", "", 15, false) ],
					[ fw.createUiInputField("name", "", 15, false) ],
					[ fw.createUiInputField("address", "", 15, false) ],
					[ fw.createUiInputField("bank", "", 15, false) ],
					[ fw.createUiInputField("iban", "", 15, false) ],
					[ fw.createUiInputField("bic", "", 15, false) ] ] };
	var frameList = [ { frameType: "fixedListFrame", frame: userItemList },
			  { frameType: "editListFrame", frame: companyItemList } ];
	var buttonList = [ { id: 501, text: "OK", callbackMessage: "saveAllCompanyData" },
			   { id: 502, text: "Cancel",  callbackMessage: "resetToMain" } ];
	var sendable = { type: "createUiPage",
			 content: { topButtonList: topButtonList,
				    frameList: frameList,
				    buttonList: buttonList } };
	fw.sendCipherTextToClient(cookie, sendable);
	fw.servicelog("Sent company data to client #" + cookie.count);
    } else {
 	fw.servicelog("User " + cookie.user.username + " does not have priviliges to edit company");
	sendMainInvoicingPanel(cookie);
    }
}

function processSaveAllCompanyData(cookie, content) {
    if(fw.userHasPrivilige("company-edit", cookie.user)) {
	// reset visibility/selection mappings as customers may change...
	mainDataVisibilityMap = [];
	mainDataSelectionMap = [];
	mainInvoiceMap = [];
	newAccess = [];
	content.items[0].frame.forEach(function(u) {
	    newAccess.push({ username: u[0][0].text,
			     company: u[1][0].value,
			     emailText: u[2][0].value });
	});
	newCompany = [];
	var nextId = ds.read("company").nextId;
	content.items[1].frame.forEach(function(t) {
	    var id = t[0][0].key;
	    if(id === "color") { id = nextId++; }
	    newCompany.push({ id: id,
			    color: t[0][0].value,
			    name: t[1][0].value,
			    address: t[2][0].value,
			    bank: t[3][0].value,
			    iban: t[4][0].value,
			    bic: t[5][0].value });
	});
	if(ds.write("access", { access: newAccess }) === false) {
	    fw.servicelog("Updating access database failed");
	} else {
	    fw.servicelog("Updated access database");
	}
	if(ds.write("company", { nextId: nextId, company: newCompany }) === false) {
	    fw.servicelog("Updating company database failed");
	} else {
	    fw.servicelog("Updated company database");
	}
    } else {
 	fw.servicelog("User " + cookie.user.username + " does not have priviliges to edit company");
    }
    sendMainInvoicingPanel(cookie);
}


// Customer data editing

function processGetcustomerDataForEdit(cookie, content) {
    fw.servicelog("Client #" + cookie.count + " requests customer edit");
    if(fw.userHasPrivilige("customer-edit", cookie.user)) {
	var topButtonList = fw.createTopButtons(cookie);
	var items = [];
	var customers = [];
	company = getCompany(cookie);
	if(company.length !== 0) {
	    company.forEach(function(c) {
		customers = customers.concat(getCompanyCustomers(c));
	    });
	}
	customers.forEach(function(c) {
	    items.push([ [ fw.createUiInputField(c.id, c.name, 15, false) ],
			 [ fw.createUiInputField("address", c.address, 15, false) ],
			 [ fw.createUiInputField("detail", c.detail, 15, false) ],
			 [ fw.createUiInputField("email", c.email, 15, false) ],
			 [ fw.createUiInputField("bankref", c.reference, 16, false) ],
			 [ fw.createUiSelectionList("company", company, c.company, true, false, false) ] ]);
	});
	var itemList = { title: "Customers",
			 frameId: 0,
			 header: [ [ [ fw.createUiHtmlCell("", "") ],
				     [ fw.createUiHtmlCell("", "<b>Name</b>") ],
				     [ fw.createUiHtmlCell("", "<b>Address</b>") ],
				     [ fw.createUiHtmlCell("", "<b>Detail</b>") ],
				     [ fw.createUiHtmlCell("", "<b>Email</b>") ],
				     [ fw.createUiHtmlCell("", "<b>Bank Reference</b>") ],
				     [ fw.createUiHtmlCell("", "<b>Company</b>") ] ] ],
			 items: items,
			 newItem: [ [ fw.createUiInputField("name", "", 15, false) ],
				    [ fw.createUiInputField("address", "", 15, false) ],
				    [ fw.createUiInputField("detail", "", 15, false) ],
				    [ fw.createUiInputField("email", "", 15, false) ],
				    [ fw.createUiInputField("bankref", "", 16, false) ],
				    [ fw.createUiSelectionList("company", company, 1, true, false, false) ] ] };
	var frameList = [ { frameType: "editListFrame", frame: itemList } ];
	var buttonList = [ { id: 501, text: "OK", callbackMessage: "saveCustomerData" },
			   { id: 502, text: "Cancel",  callbackMessage: "resetToMain" } ];
	var sendable = { type: "createUiPage",
			 content: { topButtonList: topButtonList,
				    frameList: frameList,
				    buttonList: buttonList } };
	fw.sendCipherTextToClient(cookie, sendable);
	fw.servicelog("Sent customer data to client #" + cookie.count);
    } else {
 	fw.servicelog("User " + cookie.user.username + " does not have priviliges to edit customers");
	sendMainInvoicingPanel(cookie);
    }
}

function processSaveCustomerData(cookie, content) {
    if(fw.userHasPrivilige("customer-edit", cookie.user)) {
	// reset visibility/selection mappings as customers may change...
	mainDataVisibilityMap = [];
	mainDataSelectionMap = [];
	mainInvoiceMap = [];
	var updatedCustomers = [];
	var nextId = ds.read("customers").nextId;
	content.items[0].frame.forEach(function(c) {
	    var id = c[0][0].key;
	    if(id === "name") { id = nextId++; }
	    updatedCustomers.push({ id: id,
				  name: c[0][0].value,
				  address: c[1][0].value,
				  detail: c[2][0].value,
				  email: c[3][0].value,
				  reference: c[4][0].value,
				  company: c[5][0].selected });
	});
	var newCustomers = [];
	var company = getCompany(cookie);
	ds.read("customers").customers.forEach(function(c) {
	    if(!company.map(function(t) {
		return (t === c.company);
	    }).filter(function(f){ return f; })[0]) {
		newCustomers.push(c);
	    }
	});
	updatedCustomers.forEach(function(u) {
	    newCustomers.push(u);
	});
	if(ds.write("customers", { nextId: nextId, customers: newCustomers }) === false) {
	    fw.servicelog("Updating customers database failed");
	} else {
	    fw.servicelog("Updated customers database");
	}
    } else {
 	fw.servicelog("User " + cookie.user.username + " does not have priviliges to edit customers");
    }
    sendMainInvoicingPanel(cookie);
}


// Invoice data editing

function processGetInvoicesForEdit(cookie, content) {
    fw.servicelog("Client #" + cookie.count + " requests invoices edit");
    if(fw.userHasPrivilige("invoice-edit", cookie.user)) {
	var topButtonList = fw.createTopButtons(cookie);
	var items = [];
	var invoices = [];
	ds.read("invoices").invoices.forEach(function(i) {
	    if(i.user === cookie.user.username) { invoices.push(i); }
	});
	invoices.forEach(function(i) {
	    items.push([ [ fw.createUiInputField(i.id, i.description, 15, false) ],
			 [ fw.createUiInputField("price", i.price, 15, false) ],
			 [ fw.createUiInputField("vat", i.vat, 15, false) ] ]);
	});

	var itemList = { title: "Invoices",
			 frameId: 0,
			 header: [ [ [ fw.createUiHtmlCell("", "") ],
				     [ fw.createUiHtmlCell("", "<b>Item</b>") ],
				     [ fw.createUiHtmlCell("", "<b>Price w/o taxes</b>") ],
				     [ fw.createUiHtmlCell("", "<b>Vat %</b>") ] ] ],
			 items: items,
			 newItem: [ [ fw.createUiInputField("description", "", 15, false) ],
				    [ fw.createUiInputField("price", "", 15, false) ],
				    [ fw.createUiInputField("vat", "", 15, false) ] ] };

	var frameList = [ { frameType: "editListFrame", frame: itemList } ];
	var buttonList = [ { id: 501, text: "OK", callbackMessage: "saveAllInvoiceData" },
			   { id: 502, text: "Cancel",  callbackMessage: "resetToMain" } ];

	var sendable = { type: "createUiPage",
			 content: { topButtonList: topButtonList,
				    frameList: frameList,
				    buttonList: buttonList } };
	fw.sendCipherTextToClient(cookie, sendable);
	fw.servicelog("Sent invoice data to client #" + cookie.count);
    } else {
 	fw.servicelog("User " + cookie.user.username + " does not have priviliges to edit invoices");
	sendMainInvoicingPanel(cookie);
    }
}

function processSaveAllInvoiceData(cookie, content) {
    if(fw.userHasPrivilige("invoice-edit", cookie.user)) {
	// reset visibility/selection mappings as customers may change...
	mainDataVisibilityMap = [];
	mainDataSelectionMap = [];
	mainInvoiceMap = [];
	var newInvoices = [];
	var nextId = ds.read("invoices").nextId;
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
	ds.read("invoices").invoices.forEach(function(i) {
	    if(i.user !== cookie.user.username) { allInvoices.push(i); }
	});
	allInvoices = allInvoices.concat(newInvoices);
	if(ds.write("invoices", { nextId: nextId, invoices: allInvoices }) === false) {
	    fw.servicelog("Updating invoice database failed");
	} else {
	    fw.servicelog("Updated invoice database");
	}
    } else {
 	fw.servicelog("User " + cookie.user.username + " does not have priviliges to edit invoices");
    }
    sendMainInvoicingPanel(cookie);
}


// Archived invoices

function processGetArchiveForEdit(cookie, content) {
    fw.servicelog("Client #" + cookie.count + " requests archives edit");
    if(fw.userHasPrivilige("archive-edit", cookie.user)) {
	var topButtonList = fw.createTopButtons(cookie);
	var items = [];
	var invoices = [];
	ds.read("archive").archive.forEach(function(a) {
	    if(a.user === cookie.user.username) { invoices.push(a); }
	});
	invoices.forEach(function(i) {
	    items.push([ [ fw.createUiCheckBox(i.id, false, "tick", true) ],
			 [ fw.createUiTextNode("bill", i.number) ],
			 [ fw.createUiTextNode("date", i.date) ],
			 [ fw.createUiTextNode("due", i.dueDate) ],
			 [ fw.createUiTextNode("customer", i.name) ],
			 [ fw.createUiTextNode("items", "[ " + i.invoice.items.map(function(i){ return i.id; }) + " ]") ],
			 [ fw.createUiTextNode("total", (i.invoice.totalNoVat + i.invoice.totalVat).toFixed(2)) ] ]);
	});
	var itemList = { title: "Invoices",
			 frameId: 0,
			 header: [ [ [ fw.createUiHtmlCell("", "<b>Select</b>") ],
				     [ fw.createUiHtmlCell("", "<b>Bill</b>") ],
				     [ fw.createUiHtmlCell("", "<b>Date</b>") ],
				     [ fw.createUiHtmlCell("", "<b>Due</b>") ],
				     [ fw.createUiHtmlCell("", "<b>Customer</b>") ],
				     [ fw.createUiHtmlCell("", "<b>Items</b>") ],
				     [ fw.createUiHtmlCell("", "<b>Total</b>") ] ] ],
			 items: items };
	var frameList = [ { frameType: "fixedListFrame", frame: itemList } ]
	var buttonList = [ { id: 501, text: "Lataa valitut laskut zippitiedostona",  callbackMessage: "downloadArchived" },
			   { id: 502, text: "Poista valitut laskut",  callbackMessage: "deleteArchived" },
			   { id: 503, text: "Cancel", callbackMessage: "resetToMain" } ];
	var sendable = { type: "createUiPage",
			 content: { topButtonList: topButtonList,
				    frameList: frameList,
				    buttonList: buttonList } };
	fw.sendCipherTextToClient(cookie, sendable);
	fw.servicelog("Sent archive data to client #" + cookie.count);
    } else {
 	fw.servicelog("User " + cookie.user.username + " does not have priviliges to edit archived items");
	sendMainInvoicingPanel(cookie);
    }
}

function processDownloadArchived(cookie, content) {
    if(fw.userHasPrivilige("archive-edit", cookie.user)) {
	var items = [];
	content.items[0].frame.forEach(function(i) {
	    if(i[0][0].checked) {
		items.push(i[0][0].key);
	    }
	});
	var csvLines = [];
	ds.read("archive").archive.forEach(function(a) {
	    if(items.map(function(i) {
		if(a.id === i) { return i; }
	    }).filter(function(f){ return f; }).length !== 0) {
		var iList = "";
		a.invoice.items.forEach(function(j) {
		    iList = iList.concat(j.description + ";" +
					 j.count + ";" +
					 parseFloat(j.price).toFixed(2) + ";" +
					 parseFloat(j.vat).toFixed(2) + ";");
		});
		var line = a.number + ";" +
		    a.name + ";" +
		    a.reference + ";" +
		    a.company + ";" +
		    a.date + ";" +
		    a.dueDate + ";" +
		    parseFloat(a.invoice.totalNoVat).toFixed(2) + ";" +
		    parseFloat(a.invoice.totalVat).toFixed(2)  + ";" +
		    parseFloat(a.invoice.totalNoVat + a.invoice.totalVat).toFixed(2) + ";" +
		    iList;
		csvLines.push(line);
	    }
	});
	pushArchiveFileZiptoClient(cookie, csvLines);
    } else {
  	fw.servicelog("User " + cookie.user.username + " does not have priviliges to edit archived items");
	sendMainInvoicingPanel(cookie);
   }
}

function processDeleteArchived(cookie, content) {
    if(fw.userHasPrivilige("archive-edit", cookie.user)) {
	var items = [];
	content.items[0].frame.forEach(function(i) {
	    if(i[0][0].checked) {
		items.push(i[0][0].key);
	    }
	});
	var newArchive = [];
	var nextId = ds.read("archive").nextId;
	ds.read("archive").archive.forEach(function(a) {
	    if(items.map(function(i) {
		if(a.id === i) { return i; }
	    }).filter(function(f){ return f; }).length === 0) {
		newArchive.push(a);
	    }
	});
	if(ds.write("archive", { nextId: nextId, archive: newArchive }) === false) {
	    fw.servicelog("Updating archive database failed");
	} else {
	    fw.servicelog("Updated archive database");
	}
    } else {
  	fw.servicelog("User " + cookie.user.username + " does not have priviliges to delete archived items");
	sendMainInvoicingPanel(cookie);
    }
    processGetArchiveForEdit(cookie, {});
}

function processDownloadInvoices(cookie, content) {
    var customerList = createCustomerList(content);
    if(customerList.length === 0) {
	fw.servicelog("No selections, cancelling pdf downloading");
	return;
    }
    var itemList = []
    flag = false;
    content.items[1].frame.forEach(function(i) {
	itemList.push(i[1][0].selected);
	if(i[1][0].selected !== "") {
	    flag = true;
	}
    });
    if(!flag) {
	fw.servicelog("No selections, cancelling pdf downloading");
	return;
    }
    cookie.user.applicationData.sentMailList = [];
    fw.servicelog("Client #" + cookie.count + " requests invoice downloading");
    fw.setStatustoClient(cookie, "Downloading invoices");
    pdfData = [];
    customerList.forEach(function(p) {
	var invoice = [];
	var index = 0;
	itemList.forEach(function(i) {
	    var item = [];
	    ds.read("invoices").invoices.forEach(function(j) {
		if(j.id === parseInt(i.split('.')[0])) {
		    if(p.items[index] !== 0) {
			item.push({ item: j, count: p.items[index] });
		    }
		    index++;
		}
	    })
	    if(item.length !== 0) { invoice.push(item[0]); }
	});
	var customer = ds.read("customers").customers.map(function(q) {
	    if(q.id === p.customer) { return q; }
	}).filter(function(f){ return f; })[0];
	var company = ds.read("company").company.map(function(t) {
	    if(customer.company === t.color) { return t; }
	}).filter(function(f){ return f; })[0];
	pdfData.push({ customer: customer,
		       company: company,
		       invoice: invoice,
		       dueDays: dueDateToDays(p.dueDate) });
    });
    var now = new Date();
    var billNumber = getniceDateTime(now);
    pdfData.forEach(function(p) {
	var dueDate = getNiceDate(new Date(now.valueOf()+(60*60*24*1000*p.dueDays)));
	archiveInvoice(cookie, billNumber, p.customer, p.company, p.invoice, now, dueDate);
	createPdfInvoice(cookie, billNumber++, p.customer, p.company, p.invoice, dueDate, "", pdfData.length, dontSendEmail);
    });
}

function processSendInvoicesByEmail(cookie, content) {
    var customerList = createCustomerList(content);
    if(customerList.length === 0) {
	return;
    }
    var itemList = []
    flag = false;
    content.items[1].frame.forEach(function(i) {
	itemList.push(i[1][0].selected);
	if(i[1][0].selected !== "") {
	    flag = true;
	}
    });
    if(!flag) {
	return;
    }
    var emailText = content.items[2].frame[0][0][0].value
    // Save the list to cookie.applicationData while showing the confirnmation popup.
    cookie.user.applicationData.sentMailList = [];
    cookie.user.applicationData.invoices = { customers: customerList,
					     items: itemList,
					     emailText: emailText };
    var newAccess = [];
    ds.read("access").access.forEach(function(a) {
	if(a.username !== cookie.user.username) {
	    newAccess.push(a);
	} else {
	    a.emailText = emailText;
	    newAccess.push(a);
	}
    });
    if(ds.write("access", { access: newAccess }) === false) {
	fw.servicelog("Updating access database failed");
    } else {
	fw.servicelog("Updated access database");
    }
    var confirmText = "Olet lähettämässä " +
	customerList.length + " laskua sähköpostilla.\nHaluatko jatkaa?"
    sendable = { type: "confirmBox",
		 content: { confirmId: "confirm_email_sending",
			    confirmText: confirmText } };
    fw.sendCipherTextToClient(cookie, sendable);
}

function createCustomerList(content) {
    var customerList = []
    content.items[0].frame.forEach(function(p) {
	var line = { customer: p[0][0].key,
		     dueDate: p[8][0].selected,
		     items: [] };
	var flag = false
	if(p[2][0].checked) { line.items.push(p[2][1].selected); flag = true; } else { line.items.push(0); }
	if(p[3][0].checked) { line.items.push(p[3][1].selected); flag = true; } else { line.items.push(0); }
	if(p[4][0].checked) { line.items.push(p[4][1].selected); flag = true; } else { line.items.push(0); }
	if(p[5][0].checked) { line.items.push(p[5][1].selected); flag = true; } else { line.items.push(0); }
	if(p[6][0].checked) { line.items.push(p[6][1].selected); flag = true; } else { line.items.push(0); }
	if(p[7][0].checked) { line.items.push(p[7][1].selected); flag = true; } else { line.items.push(0); }
	if(flag) {
	    customerList.push(line)
	}
    });
    return customerList;
}

function processConfirmedEmailSending(cookie, content) {
    // when confirm popup has been clicked
    if(content.result) {
	if((cookie.user.applicationData.invoices.customers.length) === 0 ||
	   (cookie.user.applicationData.invoices.items.length === 0)) {
	    cookie.user.applicationData.invoices = {};
	    fw.servicelog("No selections, cancelling email sending");
	    return;
	}
	pdfData = [];
	cookie.user.applicationData.invoices.customers.forEach(function(p) {
	    var invoice = [];
	    var index = 0;
	    cookie.user.applicationData.invoices.items.forEach(function(i) {
		var item = [];
		ds.read("invoices").invoices.forEach(function(j) {
		    if(j.id === parseInt(i.split('.')[0])) {
			if(p.items[index] !== 0) {
			    item.push({ item: j, count: p.items[index] });
			}
			index++;
		    }
		})
		if(item.length !== 0) {	invoice.push(item[0]); }
	    });
	    var customer = ds.read("customers").customers.map(function(q) {
		if(q.id === p.customer) { return q; }
	    }).filter(function(f){ return f; })[0];
	    var emailText = cookie.user.applicationData.invoices.emailText;
	    var company = ds.read("company").company.map(function(t) {
		if(customer.company === t.color) { return t; }
	    }).filter(function(f){ return f; })[0];
	
	    pdfData.push({ customer: customer,
			   company: company,
			   invoice: invoice,
			   dueDays: dueDateToDays(p.dueDate),
			   emailText: emailText });
	});
	var now = new Date();
	var billNumber = getniceDateTime(now);
	pdfData.forEach(function(p) {
	    var dueDate = getNiceDate(new Date(now.valueOf()+(60*60*24*1000*p.dueDays)));
	    archiveInvoice(cookie, billNumber, p.customer, p.company, p.invoice, now, dueDate);
	    createPdfInvoice(cookie, billNumber++, p.customer, p.company, p.invoice, dueDate, p.emailText, pdfData.length, sendEmail);
	});
    } else {
	cookie.user.applicationData.invoices = {};
	fw.servicelog("User has cancelled sending invoice emails");
    }
}

function createPdfInvoice(cookie, billNumber, customer, company, invoice, dueDate, emailText, totalEmailNumber, callback) {
    var now = new Date();
    var customerName = customer.name.replace(/\W+/g , "_");
    var filename = "./temp/" + customerName + "_" + billNumber + ".pdf";

    var itemizedInvoice = createItemizedInvoice(invoice);
    var bill = { companyName: company.name,
		 companyAddress: company.address,
		 bank: company.bank,
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
		 expireDate: dueDate,
		 notice: "14 vrk." }
    var mailDetails = { text: emailText,
			from: ds.read("email").sender,
			"reply-to": cookie.user.realname + " <" + cookie.user.email + ">",
			to: customer.email,
			subject: "Uusi lasku " + company.name + " / " + billNumber,
			attachment: [ { path: filename,
					type: "application/pdf",
					name: customer.name.replace(" ", "_") + "_" + billNumber + ".pdf" }]};
    pdfprinter.printSheet(callback, cookie, mailDetails, filename, bill, itemizedInvoice, "invoice sending",
			  totalEmailNumber, billNumber);
    fw.servicelog("Created PDF document");
}

function createItemizedInvoice(invoice) {
    var itemizedInvoice = { items: [],
			    totalNoVat: invoice.map(function(i) {
				return parseInt(i.count) * parseFloat(i.item.price);
			    }).reduce(function(a, b) {return a + b; }),
			    totalVat: invoice.map(function(i) {
				return parseInt(i.count) * parseFloat(i.item.price) * parseFloat(i.item.vat)/100;
			    }).reduce(function(a, b) {return a + b; }) };
    invoice.forEach( function(i) {
	var price = parseInt(i.count) * parseFloat(i.item.price);
	var vatPrice = price + price * parseFloat(i.item.vat) / 100;
	itemizedInvoice.items.push({ id: i.item.id,
				     description: i.item.description,
				     count: i.count,
				     price: i.item.price,
				     vat: i.item.vat,
				     vatPrice: vatPrice.toFixed(2) });
    });
    return itemizedInvoice;
}

function archiveInvoice(cookie, billNumber, customer, company, invoice, now, dueDate) {
    var newArchive = [];
    var nextId = ds.read("archive").nextId;
    ds.read("archive").archive.forEach(function(a) {
	newArchive.push(a)
    });
    var itemizedInvoice = createItemizedInvoice(invoice);
    newArchive.push({ id: nextId++,
		      user: cookie.user.username,
		      number: billNumber,
		      name: customer.name,
		      reference: customer.reference,
		      company: company.name,
		      invoice: itemizedInvoice,
		      date: getNiceDate(now),
		      dueDate: dueDate });
    if(ds.write("archive", { nextId: nextId, archive: newArchive }) === false) {
	fw.servicelog("Updating archive database failed");
    } else {
	fw.servicelog("Updated archive database");
    }
}

function pushPreviewToClient(cookie, dummy1, filename, dummy2, dummy3, dummy4) {
    if(filename == null) {
	fw.setStatustoClient(cookie, "No preview available");
        fw.servicelog("No PDF preview available");
	return;
    }
    try {
	var pdfFile = fs.readFileSync(filename).toString("base64");
    } catch(err) {
	fw.servicelog("Failed to load PDF preview file: " + err);
	fw.setStatustoClient(cookie, "PDF load failure!");
	return;
    }
    var sendable = { type: "pdfUpload",
		     content: pdfFile };
    fw.sendCipherTextToClient(cookie, sendable);
    fw.setStatustoClient(cookie, "OK");
    fw.servicelog("pushed preview PDF to client");
}

function dontSendEmail(cookie, dummy, filename, logline, totalInvoiceCount, billNumber) {
    cookie.user.applicationData.sentMailList.push(filename);
    if(cookie.user.applicationData.sentMailList.length === totalInvoiceCount) {
	pushSentEmailZipToClient(cookie, billNumber);
    }
}

function sendEmail(cookie, emailDetails, filename, logline, totalEmailCount, billNumber) {
    var emailData = ds.read("email");
    if(emailData.blindlyTrust) {
	fw.servicelog("Trusting self-signed certificates");
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
    email.server.connect({
	user: emailData.user,
	password: emailData.password,
	host: emailData.host,
	ssl: emailData.ssl
    }).send(emailDetails, function(err, message) {
	if(err) {
	    fw.servicelog(err + " : " + JSON.stringify(message));
	    fw.setStatustoClient(cookie, "Failed sending email!");
	    if(filename) {
		var newFilename =  "./failed_invoices/" + path.basename(filename);
		fs.renameSync(filename, newFilename);
		cookie.user.applicationData.sentMailList.push(newFilename);
		if(cookie.user.applicationData.sentMailList.length === totalEmailCount) {
		    pushSentEmailZipToClient(cookie, billNumber);
		}
	    }
	} else {
	    fw.servicelog("Sent " + logline + " email to " + emailDetails.to);
	    fw.setStatustoClient(cookie, "Sent email");
	    if(filename) {
		var newFilename =  "./sent_invoices/" + path.basename(filename);
		fs.renameSync(filename, newFilename);
		cookie.user.applicationData.sentMailList.push(newFilename);
		if(cookie.user.applicationData.sentMailList.length === totalEmailCount) {
		    pushSentEmailZipToClient(cookie, billNumber);
		}
	    }
	}
    });
}

function pushSentEmailZipToClient(cookie, billNumber) {
    var zipFileName = "./temp/invoices_" + billNumber + ".zip"
    var zipFileStream = fs.createWriteStream(zipFileName);
    var zipFile = archiver("zip");
    zipFile.pipe(zipFileStream);
    for(i=0; i<cookie.user.applicationData.sentMailList.length; i++) {
	var fileName = cookie.user.applicationData.sentMailList[i].replace("./", "");
	zipFile.append(fs.createReadStream(fileName), { name: fileName });
    }
    zipFile.finalize();

    zipFile.on('error', function(err) {
	fw.servicelog("Error creating invoice zipfile: " + JSON.stringify(err));
	return;
    });

    zipFileStream.on('close', function() {
	try {
	    var zipFile = fs.readFileSync(zipFileName).toString("base64");
	} catch(err) {
	    fw.servicelog("Failed to load zipfile: " + err);
	    fw.setStatustoClient(cookie, "zipfile load failure!");
	    return;
	}
	// remove selevtions and scroll to top
	mainDataVisibilityMap = [];
	mainDataSelectionMap = [];
	mainInvoiceMap = [];
	scrollScreenToTop(cookie);
	var sendable = { type: "zipUpload",
			 content: zipFile };
	fw.sendCipherTextToClient(cookie, sendable);
	fw.servicelog("pushed email zipfile to client");
	fw.setStatustoClient(cookie, "OK");
    });
}

function pushArchiveFileZiptoClient(cookie, archive) {
    var archiveFileName = "./temp/archive_" + getniceDateTime(new Date()) + ".csv"
    var archiveStream = fs.createWriteStream(archiveFileName, {flags:'a'});
    var zipFileName = "./temp/archive_" + getniceDateTime(new Date()) + ".zip"
    var zipFileStream = fs.createWriteStream(zipFileName);
    var zipFile = archiver("zip");
    archive.forEach(function(a) {
	archiveStream.write(a + "\n");
    });
    archiveStream.end();
    zipFile.pipe(zipFileStream);
    zipFile.append(fs.createReadStream(archiveFileName), { name: archiveFileName });
    zipFile.finalize();
    zipFile.on('error', function(err) {
	fw.servicelog("Error creating archive zipfile: " + JSON.stringify(err));
	return;
    });
    zipFileStream.on('close', function() {
	try {
	    fs.unlinkSync(archiveFileName);
	    var zipFile = fs.readFileSync(zipFileName).toString("base64");
	} catch(err) {
	    fw.servicelog("Failed to load zipfile: " + err);
	    fw.setStatustoClient(cookie, "zipfile load failure!");
	    return;
	}
	scrollScreenToTop(cookie);
	var sendable = { type: "zipUpload",
			 content: zipFile };
	fw.sendCipherTextToClient(cookie, sendable);
	fw.servicelog("pushed archive zipfile to client");
	fw.setStatustoClient(cookie, "OK");
    });
}


// helpers

function scrollScreenToTop(cookie) {
    var sendable = { type: "scrollToTop", content: {} };
    fw.sendCipherTextToClient(cookie, sendable);
}

function getNiceDate(date) {
    return date.getDate() + "." + (date.getMonth()+1) + "." + date.getFullYear();
}

function getniceDateTime(date) {
    return (date.getDate().toString() + (date.getMonth()+1).toString() + date.getFullYear().toString() +
	    date.getHours().toString() + date.getMinutes().toString());
}

function dueDateToDays(dueDate) {
    dueDays = 0;
    if(dueDate === "1 viikko") { dueDays = 7; }
    if(dueDate === "2 viikkoa") { dueDays = 14; }
    if(dueDate === "3 viikkoa") { dueDays = 21; }
    if(dueDate === "4 viikkoa") { dueDays = 28; }
    return dueDays;
}


// database conversion and update

function updateDatabaseVersionTo_1() {
    var mainConfig = ds.read("main").main;
    var userConfig = ds.read("users").users;
    var companyConfig = ds.read("company").company;
    var customersConfig = ds.read("customers").customers;
    var invoicesConfig = ds.read("invoices").invoices;
    var nextId;

    var newUserConfig = []
    userConfig.forEach(function(u) {
	newUserConfig.push({ username: u.username,
			     hash: u.hash,
			     password: u.password,
			     realname: u.realname,
			     email: u.email,
			     phone: u.phone,
			     language: mainConfig.defaultLanguage,
			     applicationData: { priviliges: u.applicationData.priviliges } });
    });
    if(ds.write("users", { users: newUserConfig }) === false) {
	fw.servicelog("Updating user database failed");
	process.exit(1);
    } else {
	fw.servicelog("Updated user database to v.1");
    }

    var newAccessConfig = [];
    userConfig.forEach(function(u) {
	newAccessConfig.push({ username: u.username,
			       company: u.applicationData.teams[0],
			       emailText: u.applicationData.emailText });
    });
    if(ds.write("access", { access: newAccessConfig }) === false) {
	fw.servicelog("Updating access database failed");
	process.exit(1);
    } else {
	fw.servicelog("Updated access database to v.1");
    }

    var newCompanyConfig = [];
    nextId = 1;
    companyConfig.forEach(function(c) {
	newCompanyConfig.push({ id: nextId++,
				color: c.id,
				name: c.name,
				address: c.address,
				bank: c.bankName,
				iban: c.iban,
				bic: c.bic });
    });
    if(ds.write("company", { nextId: nextId, company: newCompanyConfig }) === false) {
	fw.servicelog("Updating company database failed");
	process.exit(1);
    } else {
	fw.servicelog("Updated company database to v.1");
    }

    var newCustomersConfig = [];
    nextId = 1;
    customersConfig.forEach(function(c) {
	newCustomersConfig.push({ id: nextId++,
				  name: c.name,
				  address: c.address,
				  detail: c.detail,
				  email: c.email,
				  reference: c.reference,
				  company: c.team });
    });
    if(ds.write("customers", { nextId: nextId, customers: newCustomersConfig }) === false) {
	fw.servicelog("Updating customers database failed");
	process.exit(1);
    } else {
	fw.servicelog("Updated customers database to v.1");
    }

    var newInvoiceConfig = [];
    nextId = 1;
    ds.read("invoices").invoices.forEach(function(i) {
	newInvoiceConfig.push({ id: nextId++,
				description: i.description,
				price: i.price,
				user: i.user,
				vat: i.vat });
    });
    if(ds.write("invoices", { nextId: nextId, invoices: newInvoiceConfig }) === false) {
	fw.servicelog("Updating invoices database failed");
	process.exit(1);
    } else {
	fw.servicelog("Updated invoices database to v.1");
    }

    if(ds.write("main", { main: { version: 1,
				  port: mainConfig.port,
				  siteFullUrl: mainConfig.siteFullUrl,
				  emailVerification: false,
				  defaultLanguage: mainConfig.language } } ) === false) {
	fw.servicelog("Updating main database failed");
	process.exit(1);
    } else {
	fw.servicelog("Updated main database to v.1");
    }
}


// Create needed directories

if (!fs.existsSync("./temp/")){ fs.mkdirSync("./temp/"); }
if (!fs.existsSync("./sent_invoices/")){ fs.mkdirSync("./sent_invoices/"); }
if (!fs.existsSync("./failed_invoices/")){ fs.mkdirSync("./failed_invoices/"); }


// Initialize application-specific datastorages

function initializeDataStorages() {
    fw.initializeDataStorages();
    var mainConfig = ds.read("main").main;
    if(mainConfig.version === undefined) {
	mainConfig.version = 0;
    }
    ds.initialize("invoices", { nextId: 1, invoices: [] }, true);
    ds.initialize("company", { nextId: 1, company: [] }, true);
    ds.initialize("customers", { nextId: 1, customers: [] }, true);
    ds.initialize("access", { access: [] }, true);
    ds.initialize("archive", { nextId: 1, archive: [] }, true);

    if(mainConfig.version > databaseVersion) {
	fw.servicelog("Database version is too high for this program release, please update program.");
	process.exit(1);
    }
    if(mainConfig.version < databaseVersion) {
	fw.servicelog("Updating database version to most recent supported by this program release.");
	if(mainConfig.version === 0) {
	    // update database version from 0 to 1
	    updateDatabaseVersionTo_1();
	}
    }
}


// Push callbacks to framework

fw.setCallback("datastorageRead", ds.read);
fw.setCallback("datastorageWrite", ds.write);
fw.setCallback("datastorageInitialize", ds.initialize);
fw.setCallback("handleApplicationMessage", handleApplicationMessage);
fw.setCallback("processResetToMainState", processResetToMainState);
fw.setCallback("createAdminPanelUserPriviliges", createAdminPanelUserPriviliges);
fw.setCallback("createDefaultPriviliges", createDefaultPriviliges);
fw.setCallback("createTopButtonList", createTopButtonList);


// Start the web interface

initializeDataStorages();
fw.setApplicationName("Pantterilasku");
fw.startUiLoop();

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
    if(decryptedMessage.type === "getTeamsDataForEdit") {
	processGetTeamsDataForEdit(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "getPlayerDataForEdit") {
	processGetplayerDataForEdit(cookie, decryptedMessage.content); }
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
    if(decryptedMessage.type === "saveAllTeamsData") {
	processSaveAllTeamsData(cookie, decryptedMessage.content); }
    if(decryptedMessage.type === "savePlayerData") {
	processSavePlayerData(cookie, decryptedMessage.content); }
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
	    framework.servicelog("Received undefined confirm response");
	}
    }
}


// helpers

function getTeams(cookie) {
    return datastorage.read("access").access.map(function(a) {
	if(a.username === cookie.user.username) {
	    return a.teams;
	}
    }).filter(function(f){ return f; })[0].split(',');
}

function getTeamPlayers(team) {
    var players = [];
    datastorage.read("players").players.forEach(function(p) {
	if(p.team === team) { players.push(p); }
    });
    return players;
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

function createPreviewLink(count, id, value) {
    return [ framework.createUiHtmlCell("", "<a href=#>preview</a>", "#ffffff", !value,
					"sendToServerEncrypted('previewLinkClicked', { count: " + count + ", id: " + id + " } );") ];
}


// Administration UI panel requires application to provide needed priviliges

function createAdminPanelUserPriviliges() {
    return [ { privilige: "view", code: "v" },
	     { privilige: "archive-edit", code: "ar"},
	     { privilige: "teams-edit", code: "te"},
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
    return [ { button: { text: "Muokkaa Joukkueita", callbackMessage: "getTeamsDataForEdit" },
	       priviliges: [ "teams-edit" ] },
	     { button: { text: "Muokkaa Pelaajia", callbackMessage: "getPlayerDataForEdit" },
	       priviliges: [ "customer-edit" ] },
	     { button: { text: "Muokkaa Laskupohjia", callbackMessage: "getInvoicesForEdit" },
	       priviliges: [ "invoice-edit" ] },
	     { button: { text: "Arkisto", callbackMessage: "getArchiveForEdit" },
	       priviliges: [ "archive-edit" ] } ];
}


// Main UI panel, list of customers and invoices

function processResetToMainState(cookie, content) {
    // this shows up the first UI panel when uses login succeeds or other panels send "OK" / "Cancel"
    framework.servicelog("User session reset to main state");
    cookie.user = datastorage.read("users").users.filter(function(u) {
	return u.username === cookie.user.username;
    })[0];
    sendMainInvoicingPanel(cookie);
}

var mainDataVisibilityMap = [];
var mainDataSelectionMap = [];
var mainInvoiceMap = [];

function sendMainInvoicingPanel(cookie) {
//    framework.servicelog("My own cookie is: " + util.inspect(cookie));
    var sendable;
    var topButtonList = framework.createTopButtons(cookie, [ { button: { text: "Help",
									 callbackMessage: "getMainHelp" } } ]);
    var players = [];
    teams = getTeams(cookie);
    if(teams.length !== 0) {
	teams.forEach(function(t) {
	    players = players.concat(getTeamPlayers(t));
	});
    }
    var invoices = [];
    datastorage.read("invoices").invoices.forEach(function(i) {
	if(i.user === cookie.user.username) { invoices.push(i); }
    });

    if(mainDataVisibilityMap.length === 0) {
	var count = 0
	while(count < players.length * 8 + 8) {
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

    var emailText = datastorage.read("access").access.map(function(a) {
	if(a.username === cookie.user.username) { return a.emailText; }
    }).filter(function(f){ return f; })[0];
	
    var playerList = { title: "Pelaajat",
		       frameId: 0,
		       header: fillHeaderRows(players, mainDataVisibilityMap, mainDataSelectionMap),
		       items: fillCustomerRows(players, mainDataVisibilityMap, mainDataSelectionMap) };

    var invoiceList = { title: "Laskupohjat",
			frameId: 1,
			header: [ [ [ framework.createUiHtmlCell("", "") ], [ framework.createUiHtmlCell("", "") ] ] ],
			items: createInvoiceTable(invoices, mainInvoiceMap) };

    var emailList = { title: "Sähköpostin saateteksti",
		      frameId: 2,
		      header: [ [] ],
		      items: [ [ [ framework.createUiTextArea("emailText", emailText, 80, 5) ] ] ] };

    var buttonList = [ { id: 501, text: "Lähetä laskut sähköpostilla!", callbackMessage: "sendInvoicesByEmail" },
		       { id: 502, text: "Lataa laskut zippitiedostona",  callbackMessage: "downloadInvoices" } ];

    var frameList = [ { frameType: "fixedListFrame", frame: playerList },
		      { frameType: "fixedListFrame", frame: invoiceList },
		      { frameType: "fixedListFrame", frame: emailList } ];

    sendable = { type: "createUiPage",
		 content: { topButtonList: topButtonList,
			    frameList: frameList,
			    buttonList: buttonList } };

    framework.sendCipherTextToClient(cookie, sendable);
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
		     [ framework.createUiSelectionList("sel", invoices.map(function(i) { return i.id + ". " + i.description; }), iMap[count], true, false, true,
						       "var nSelection = document.getElementById(this.id); sendToServerEncrypted('invoiceSelectorSelected', { id: " + count + ", state: nSelection.options[nSelection.selectedIndex].item })") ] ] );
	count ++;
    }
    return items;
}

function fillCustomerRows(customers, vMap, sMap) {
    var count = 8
    var items = [];
    customers.forEach(function(c) {
	items.push( [ [ framework.createUiTextNode(c.id, c.name) ],  [ framework.createUiTextNode("team", c.team) ],
		      createClickerElement(count, vMap[count], sMap[count++]), createClickerElement(count, vMap[count], sMap[count++]),
		      createClickerElement(count, vMap[count], sMap[count++]), createClickerElement(count, vMap[count], sMap[count++]),
		      createClickerElement(count, vMap[count], sMap[count++]), createClickerElement(count, vMap[count], sMap[count++]),
		      createDueDateElement(false, count, sMap[count++]), createPreviewLink((count-7)/8, c.id, vMap[count++]),
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
    var player = datastorage.read("players").players.map(function(q) {
	if(q.id === content.id) { return q; }
    }).filter(function(f){ return f; })[0];
    var team = datastorage.read("teams").teams.map(function(t) {
	if(player.team === t.color) { return t; }
    }).filter(function(f){ return f; })[0];
    var invoice = [];
    items.forEach(function(i) {
	invoice.push(datastorage.read("invoices").invoices.map(function(j) {
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
    framework.setStatustoClient(cookie, "Printing preview");
    createPdfInvoice(cookie, billNumber++, player, team, invoice, dueDate, "", 0, pushPreviewToClient)
}

function dueDateToDays(dueDate) {
    dueDays = 0;
    if(dueDate === "1 viikko") { dueDays = 7; }
    if(dueDate === "2 viikkoa") { dueDays = 14; }
    if(dueDate === "3 viikkoa") { dueDays = 21; }
    if(dueDate === "4 viikkoa") { dueDays = 28; }
    return dueDays;
}
    
function processInvoiceSelectorSelected(cookie, content) {
    mainInvoiceMap[content.id] = content.state;
}


// Teams data editing

function processGetTeamsDataForEdit(cookie, content) {
    framework.servicelog("Client #" + cookie.count + " requests teams edit");
    if(framework.userHasPrivilige("teams-edit", cookie.user)) {
	var topButtonList = framework.createTopButtons(cookie);
	var users = [];
	var access = datastorage.read("access").access;
	datastorage.read("users").users.forEach(function(u) {
	    users.push({ user: u.username,
			 teams: access.map(function(a) {
			     if(u.username === a.username) { return a.teams; }
			 }).filter(function(f){ return f; }),
			 emailText: access.map(function(a) {
			     if(u.username === a.username) { return a.emailText; }
			 }).filter(function(f){ return f; })
		       });
	});
	var userItems = [];
	users.forEach(function(u) {
	    userItems.push([ [ framework.createUiTextNode("username", u.user) ],
			     [ framework.createUiInputField("teams", u.teams, 15, false) ],
			     [ framework.createUiInputField("teams", u.emailText, 35, false) ] ]);
	});
	var userItemList = { title: "Users",
			     frameId: 0,
			     header: [ [ [ framework.createUiHtmlCell("", "<b>User</b>") ],
				       [ framework.createUiHtmlCell("", "<b>Team colors</b>") ] ] ],
			     items: userItems };
	var teamItems = [];
	datastorage.read("teams").teams.forEach(function(t) {
	    teamItems.push([ [ framework.createUiInputField(t.id, t.color, 15, false) ],
			     [ framework.createUiInputField("name", t.name, 15, false) ],
			     [ framework.createUiInputField("address", t.address, 15, false) ],
			     [ framework.createUiInputField("bank", t.bank, 15, false) ],
			     [ framework.createUiInputField("iban", t.iban, 15, false) ],
			     [ framework.createUiInputField("bic", t.bic, 15, false) ] ]);
	});
	var teamItemList = { title: "Teams",
			     frameId: 1,
			     header: [ [ [ framework.createUiHtmlCell("", "") ],
					 [ framework.createUiHtmlCell("", "<b>Color</b>") ],
					 [ framework.createUiHtmlCell("", "<b>Name</b>") ],
					 [ framework.createUiHtmlCell("", "<b>Address</b>") ],
					 [ framework.createUiHtmlCell("", "<b>Bank</b>") ],
					 [ framework.createUiHtmlCell("", "<b>IBAN</b>") ],
					 [ framework.createUiHtmlCell("", "<b>BIC</b>") ] ] ],
			     items: teamItems,
			     newItem: [ [ framework.createUiInputField("color", "", 15, false) ],
					[ framework.createUiInputField("name", "", 15, false) ],
					[ framework.createUiInputField("address", "", 15, false) ],
					[ framework.createUiInputField("bank", "", 15, false) ],
					[ framework.createUiInputField("iban", "", 15, false) ],
					[ framework.createUiInputField("bic", "", 15, false) ] ] };
	var frameList = [ { frameType: "fixedListFrame", frame: userItemList },
			  { frameType: "editListFrame", frame: teamItemList } ];
	var buttonList = [ { id: 501, text: "OK", callbackMessage: "saveAllTeamsData" },
			   { id: 502, text: "Cancel",  callbackMessage: "resetToMain" } ];
	var sendable = { type: "createUiPage",
			 content: { topButtonList: topButtonList,
				    frameList: frameList,
				    buttonList: buttonList } };
	framework.sendCipherTextToClient(cookie, sendable);
	framework.servicelog("Sent teams data to client #" + cookie.count);
    } else {
 	framework.servicelog("User " + cookie.user.username + " does not have priviliges to edit teams");
	sendMainInvoicingPanel(cookie);
    }
}

function processSaveAllTeamsData(cookie, content) {
    if(framework.userHasPrivilige("teams-edit", cookie.user)) {
	// reset visibility/selection mappings as customers may change...
	mainDataVisibilityMap = [];
	mainDataSelectionMap = [];
	mainInvoiceMap = [];
	newAccess = [];
	content.items[0].frame.forEach(function(u) {
	    newAccess.push({ username: u[0][0].text,
			     teams: u[1][0].value,
			     emailText: u[2][0].value });
	});
	newTeams = [];
	var nextId = datastorage.read("teams").nextId;
	content.items[1].frame.forEach(function(t) {
	    var id = t[0][0].key;
	    if(id === "color") { id = nextId++; }
	    newTeams.push({ id: id,
			    color: t[0][0].value,
			    name: t[1][0].value,
			    address: t[2][0].value,
			    bank: t[3][0].value,
			    iban: t[4][0].value,
			    bic: t[5][0].value });
	});
	if(datastorage.write("access", { access: newAccess }) === false) {
	    framework.servicelog("Updating access database failed");
	} else {
	    framework.servicelog("Updated access database");
	}
	if(datastorage.write("teams", { nextId: nextId, teams: newTeams }) === false) {
	    framework.servicelog("Updating teams database failed");
	} else {
	    framework.servicelog("Updated teams database");
	}
    } else {
 	framework.servicelog("User " + cookie.user.username + " does not have priviliges to edit teams");
    }
    sendMainInvoicingPanel(cookie);
}


// Player data editing

function processGetplayerDataForEdit(cookie, content) {
    framework.servicelog("Client #" + cookie.count + " requests player edit");
    if(framework.userHasPrivilige("customer-edit", cookie.user)) {
	var topButtonList = framework.createTopButtons(cookie);
	var items = [];
	var players = [];
	teams = getTeams(cookie);
	if(teams.length !== 0) {
	    teams.forEach(function(t) {
		players = players.concat(getTeamPlayers(t));
	    });
	}
	players.forEach(function(p) {
	    items.push([ [ framework.createUiInputField(p.id, p.name, 15, false) ],
			 [ framework.createUiInputField("address", p.address, 15, false) ],
			 [ framework.createUiInputField("detail", p.detail, 15, false) ],
			 [ framework.createUiInputField("email", p.email, 15, false) ],
			 [ framework.createUiInputField("bankref", p.reference, 16, false) ],
			 [ framework.createUiSelectionList("team", teams, p.team, true, false, false) ] ]);
	});
	var itemList = { title: "Players",
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
	var buttonList = [ { id: 501, text: "OK", callbackMessage: "savePlayerData" },
			   { id: 502, text: "Cancel",  callbackMessage: "resetToMain" } ];
	var sendable = { type: "createUiPage",
			 content: { topButtonList: topButtonList,
				    frameList: frameList,
				    buttonList: buttonList } };
	framework.sendCipherTextToClient(cookie, sendable);
	framework.servicelog("Sent player data to client #" + cookie.count);
    } else {
 	framework.servicelog("User " + cookie.user.username + " does not have priviliges to edit players");
	sendMainInvoicingPanel(cookie);
    }
}

function processSavePlayerData(cookie, content) {
    if(framework.userHasPrivilige("customer-edit", cookie.user)) {
	// reset visibility/selection mappings as players may change...
	mainDataVisibilityMap = [];
	mainDataSelectionMap = [];
	mainInvoiceMap = [];
	var updatedPlayers = [];
	var nextId = datastorage.read("players").nextId;
	content.items[0].frame.forEach(function(c) {
	    var id = c[0][0].key;
	    if(id === "name") { id = nextId++; }
	    updatedPlayers.push({ id: id,
				  name: c[0][0].value,
				  address: c[1][0].value,
				  detail: c[2][0].value,
				  email: c[3][0].value,
				  reference: c[4][0].value,
				  team: c[5][0].selected });
	});
	var newPlayers = [];
	datastorage.read("players").players.forEach(function(p) {
	    if(!teams.map(function(t) {
		return (t === p.team);
	    }).filter(function(f){ return f; })[0]) {
		newPlayers.push(p);
	    }
	});
	updatedPlayers.forEach(function(u) {
	    newPlayers.push(u);
	});
	if(datastorage.write("players", { nextId: nextId, players: newPlayers }) === false) {
	    framework.servicelog("Updating players database failed");
	} else {
	    framework.servicelog("Updated players database");
	}
    } else {
 	framework.servicelog("User " + cookie.user.username + " does not have priviliges to edit players");
    }
    sendMainInvoicingPanel(cookie);
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
	sendMainInvoicingPanel(cookie);
    }
}

function processSaveAllInvoiceData(cookie, content) {
    if(framework.userHasPrivilige("invoice-edit", cookie.user)) {
	// reset visibility/selection mappings as customers may change...
	mainDataVisibilityMap = [];
	mainDataSelectionMap = [];
	mainInvoiceMap = [];
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
    sendMainInvoicingPanel(cookie);
}


// Archived invoices

function processGetArchiveForEdit(cookie, content) {
    framework.servicelog("Client #" + cookie.count + " requests archives edit");
    if(framework.userHasPrivilige("archive-edit", cookie.user)) {
	var topButtonList = framework.createTopButtons(cookie);
	var items = [];
	var invoices = [];
	datastorage.read("archive").archive.forEach(function(a) {
	    if(a.user === cookie.user.username) { invoices.push(a); }
	});
	invoices.forEach(function(i) {
	    items.push([ [ framework.createUiCheckBox(i.id, false, "tick", true) ],
			 [ framework.createUiTextNode("bill", i.number) ],
			 [ framework.createUiTextNode("date", i.date) ],
			 [ framework.createUiTextNode("due", i.dueDate) ],
			 [ framework.createUiTextNode("player", i.name) ],
			 [ framework.createUiTextNode("items", "[ " + i.invoice.items.map(function(i){ return i.id; }) + " ]") ],
			 [ framework.createUiTextNode("total", (i.invoice.totalNoVat + i.invoice.totalVat).toFixed(2)) ] ]);
	});
	var itemList = { title: "Invoices",
			 frameId: 0,
			 header: [ [ [ framework.createUiHtmlCell("", "<b>Select</b>") ],
				     [ framework.createUiHtmlCell("", "<b>Bill</b>") ],
				     [ framework.createUiHtmlCell("", "<b>Date</b>") ],
				     [ framework.createUiHtmlCell("", "<b>Due</b>") ],
				     [ framework.createUiHtmlCell("", "<b>Player</b>") ],
				     [ framework.createUiHtmlCell("", "<b>Items</b>") ],
				     [ framework.createUiHtmlCell("", "<b>Total</b>") ] ] ],
			 items: items };
	var frameList = [ { frameType: "fixedListFrame", frame: itemList } ]
	var buttonList = [ { id: 501, text: "Lataa valitut laskut zippitiedostona",  callbackMessage: "downloadArchived" },
			   { id: 502, text: "Poista valitut laskut",  callbackMessage: "deleteArchived" },
			   { id: 503, text: "Cancel", callbackMessage: "resetToMain" } ];
	var sendable = { type: "createUiPage",
			 content: { topButtonList: topButtonList,
				    frameList: frameList,
				    buttonList: buttonList } };
	framework.sendCipherTextToClient(cookie, sendable);
	framework.servicelog("Sent archive data to client #" + cookie.count);
    } else {
 	framework.servicelog("User " + cookie.user.username + " does not have priviliges to edit archived items");
	sendMainInvoicingPanel(cookie);
    }
}

function processDownloadArchived(cookie, content) {
    var items = [];
    content.items[0].frame.forEach(function(i) {
	if(i[0][0].checked) {
	    items.push(i[0][0].key);
	}
    });
    var csvLines = [];
    datastorage.read("archive").archive.forEach(function(a) {
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
		a.team + ";" +
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
}

function processDeleteArchived(cookie, content) {
}


// helpers

function getNiceDate(date) {
    return date.getDate() + "." + (date.getMonth()+1) + "." + date.getFullYear();
}

function getniceDateTime(date) {
    return (date.getDate().toString() + (date.getMonth()+1).toString() + date.getFullYear().toString() +
	    date.getHours().toString() + date.getMinutes().toString());
}

function stateIs(cookie, state) {
    return (cookie.state === state);
}

function setState(cookie, state) {
    cookie.state = state;
}

function processDownloadInvoices(cookie, content) {
    var playerList = createPlayerList(content);
    if(playerList.length === 0) {
	framework.servicelog("No selections, cancelling pdf downloading");
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
	framework.servicelog("No selections, cancelling pdf downloading");
	return;
    }
    cookie.user.applicationData.sentMailList = [];
    framework.servicelog("Client #" + cookie.count + " requests invoice downloading");
    framework.setStatustoClient(cookie, "Downloading invoices");
    pdfData = [];
    playerList.forEach(function(p) {
	var invoice = [];
	var index = 0;
	itemList.forEach(function(i) {
	    var item = [];
	    datastorage.read("invoices").invoices.forEach(function(j) {
		if(j.id === parseInt(i.split('.')[0])) {
		    if(p.items[index] !== 0) {
			item.push({ item: j, count: p.items[index] });
		    }
		    index++;
		}
	    })
	    if(item.length !== 0) { invoice.push(item[0]); }
	});
	var player = datastorage.read("players").players.map(function(q) {
	    if(q.id === p.player) { return q; }
	}).filter(function(f){ return f; })[0];
	var team = datastorage.read("teams").teams.map(function(t) {
	    if(player.team === t.color) { return t; }
	}).filter(function(f){ return f; })[0];
	pdfData.push({ player: player,
		       team: team,
		       invoice: invoice,
		       dueDays: dueDateToDays(p.dueDate) });
    });
    var now = new Date();
    var billNumber = getniceDateTime(now);
    pdfData.forEach(function(p) {
	var dueDate = getNiceDate(new Date(now.valueOf()+(60*60*24*1000*p.dueDays)));
	archiveInvoice(cookie, billNumber, p.player, p.team, p.invoice, now, dueDate);
	createPdfInvoice(cookie, billNumber++, p.player, p.team, p.invoice, dueDate, "", pdfData.length, dontSendEmail);
    });
}

function processSendInvoicesByEmail(cookie, content) {
    var playerList = createPlayerList(content);
    if(playerList.length === 0) {
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
    cookie.user.applicationData.invoices = { players: playerList,
					     items: itemList,
					     emailText: emailText };
    var newAccess = [];
    datastorage.read("access").access.forEach(function(a) {
	if(a.username !== cookie.user.username) {
	    newAccess.push(a);
	} else {
	    a.emailText = emailText;
	    newAccess.push(a);
	}
    });
    if(datastorage.write("access", { access: newAccess }) === false) {
	framework.servicelog("Updating access database failed");
    } else {
	framework.servicelog("Updated access database");
    }
    var confirmText = "Olet lähettämässä " +
	playerList.length + " laskua sähköpostilla.\nHaluatko jatkaa?"
    sendable = { type: "confirmBox",
		 content: { confirmId: "confirm_email_sending",
			    confirmText: confirmText } };
    framework.sendCipherTextToClient(cookie, sendable);
}

function createPlayerList(content) {
    var playerList = []
    content.items[0].frame.forEach(function(p) {
	var line = { player: p[0][0].key,
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
	    playerList.push(line)
	}
    });
    return playerList;
}

function processConfirmedEmailSending(cookie, content) {
    // when confirm popup has been clicked
    if(content.result) {
	if((cookie.user.applicationData.invoices.players.length) === 0 ||
	   (cookie.user.applicationData.invoices.items.length === 0)) {
	    cookie.user.applicationData.invoices = {};
	    framework.servicelog("No selections, cancelling email sending");
	    return;
	}
	pdfData = [];
	cookie.user.applicationData.invoices.players.forEach(function(p) {
	    var invoice = [];
	    var index = 0;
	    cookie.user.applicationData.invoices.items.forEach(function(i) {
		var item = [];
		datastorage.read("invoices").invoices.forEach(function(j) {
		    if(j.id === parseInt(i.split('.')[0])) {
			if(p.items[index] !== 0) {
			    item.push({ item: j, count: p.items[index] });
			}
			index++;
		    }
		})
		if(item.length !== 0) {	invoice.push(item[0]); }
	    });
	    var player = datastorage.read("players").players.map(function(q) {
		if(q.id === p.player) { return q; }
	    }).filter(function(f){ return f; })[0];
	    var emailText = cookie.user.applicationData.invoices.emailText;
	    var team = datastorage.read("teams").teams.map(function(t) {
		if(player.team === t.color) { return t; }
	    }).filter(function(f){ return f; })[0];
	    
	    pdfData.push({ player: player,
			   team: team,
			   invoice: invoice,
			   dueDays: dueDateToDays(p.dueDate),
			   emailText: emailText });
	});
	var now = new Date();
	var billNumber = getniceDateTime(now);
	pdfData.forEach(function(p) {
	    var dueDate = getNiceDate(new Date(now.valueOf()+(60*60*24*1000*p.dueDays)));
	    archiveInvoice(cookie, billNumber, p.player, p.team, p.invoice, now, dueDate);
	    createPdfInvoice(cookie, billNumber++, p.player, p.team, p.invoice, dueDate, p.emailText, pdfData.length, sendEmail);
	});
    } else {
	cookie.user.applicationData.invoices = {};
	framework.servicelog("User has cancelled sending invoice emails");
    }
}

function createPdfInvoice(cookie, billNumber, player, team, invoice, dueDate, emailText, totalEmailNumber, callback) {
    var now = new Date();
    var playerName = player.name.replace(/\W+/g , "_");
    var filename = "./temp/" + playerName + "_" + billNumber + ".pdf";

    var itemizedInvoice = createItemizedInvoice(invoice);
    var bill = { teamName: team.name,
		 teamAddress: team.address,
		 bank: team.bank,
		 bic: team.bic,
		 iban: team.iban,
		 playerName: player.name,
		 playerAddress: player.address,
		 playerDetail: player.detail,
		 reference: player.reference,
		 date: getNiceDate(now),
		 number: billNumber,
		 id: "",
		 intrest: "",
		 expireDate: dueDate,
		 notice: "14 vrk." }
    var mailDetails = { text: emailText,
			from: datastorage.read("email").sender,
			"reply-to": cookie.user.realname + " <" + cookie.user.email + ">",
			to: player.email,
			subject: "Uusi lasku " + team.name + " / " + billNumber,
			attachment: [ { path: filename,
					type: "application/pdf",
					name: player.name.replace(" ", "_") + "_" + billNumber + ".pdf" }]};
    pdfprinter.printSheet(callback, cookie, mailDetails, filename, bill, itemizedInvoice, "invoice sending",
			  totalEmailNumber, billNumber);
    framework.servicelog("Created PDF document");
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

function archiveInvoice(cookie, billNumber, player, team, invoice, now, dueDate) {
    var newArchive = [];
    var nextId = datastorage.read("archive").nextId;
    datastorage.read("archive").archive.forEach(function(a) {
	newArchive.push(a)
    });
    var itemizedInvoice = createItemizedInvoice(invoice);
    newArchive.push({ id: nextId++,
		      user: cookie.user.username,
		      number: billNumber,
		      name: player.name,
		      reference: player.reference,
		      team: team.name,
		      invoice: itemizedInvoice,
		      date: getNiceDate(now),
		      dueDate: dueDate });
    if(datastorage.write("archive", { nextId: nextId, archive: newArchive }) === false) {
	framework.servicelog("Updating archive database failed");
    } else {
	framework.servicelog("Updated archive database");
    }
}

function processHelpScreen(cookie, content) {
    var content = JSON.parse(Aes.Ctr.decrypt(content, cookie.user.password, 128));
    servicelog("Client #" + cookie.count + " requests help screen (mode : " + JSON.stringify(content) + " )");
    if(content.mode === "user") {
	sendable = { type: "helpText",
		     content: fs.readFileSync("./" + framework.getLanguageText(cookie,
								     "HELPFILE_USER"))
		     .toString("base64") };
	sendCipherTextToClient(cookie, sendable);
    } else {
	sendable = { type: "helpText",
		     content: fs.readFileSync("./" + framework.getLanguageText(cookie,
								     "HELPFILE_ADMIN"))
		     .toString("base64") };
	sendCipherTextToClient(cookie, sendable);
    }
}

function pushPreviewToClient(cookie, dummy1, filename, dummy2, dummy3, dummy4) {
    if(filename == null) {
	framework.setStatustoClient(cookie, "No preview available");
        framework.servicelog("No PDF preview available");
	return;
    }
    if(!stateIs(cookie, "loggedIn")) {
	framework.setStatustoClient(cookie, "Login failure");
        framework.servicelog("Login failure in PDF preview sending");
	return;
    }
    try {
	var pdfFile = fs.readFileSync(filename).toString("base64");
    } catch(err) {
	framework.servicelog("Failed to load PDF preview file: " + err);
	framework.setStatustoClient(cookie, "PDF load failure!");
	return;
    }
    var sendable = { type: "pdfUpload",
		     content: pdfFile };
    framework.sendCipherTextToClient(cookie, sendable);
    framework.setStatustoClient(cookie, "OK");
    framework.servicelog("pushed preview PDF to client");
}

function readUserData() {
    userData = datastorage.read("users");
    if(userData === false) {
	servicelog("User database read failed");
    }
    return userData;
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

function dontSendEmail(cookie, dummy, filename, logline, totalInvoiceCount, billNumber) {
    cookie.user.applicationData.sentMailList.push(filename);
    if(cookie.user.applicationData.sentMailList.length === totalInvoiceCount) {
	pushSentEmailZipToClient(cookie, billNumber);
    }
}

function sendEmail(cookie, emailDetails, filename, logline, totalEmailCount, billNumber) {
    var emailData = datastorage.read("email");
    if(emailData.blindlyTrust) {
	framework.servicelog("Trusting self-signed certificates");
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
    email.server.connect({
	user: emailData.user,
	password: emailData.password,
	host: emailData.host,
	ssl: emailData.ssl
    }).send(emailDetails, function(err, message) {
	if(err) {
	    framework.servicelog(err + " : " + JSON.stringify(message));
	    framework.setStatustoClient(cookie, "Failed sending email!");
	    if(filename) {
		var newFilename =  "./failed_invoices/" + path.basename(filename);
		fs.renameSync(filename, newFilename);
		cookie.user.applicationData.sentMailList.push(newFilename);
		if(cookie.user.applicationData.sentMailList.length === totalEmailCount) {
		    pushSentEmailZipToClient(cookie, billNumber);
		}
	    }
	} else {
	    framework.servicelog("Sent " + logline + " email to " + emailDetails.to);
	    framework.setStatustoClient(cookie, "Sent email");
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
	framework.servicelog("Error creating invoice zipfile: " + JSON.stringify(err));
	return;
    });

    zipFileStream.on('close', function() {
	if(!stateIs(cookie, "loggedIn")) {
	    framework.setStatustoClient(cookie, "Login failure");
	    framework.servicelog("Login failure in zipfile sending");
	    return;
	}
	try {
	    var zipFile = fs.readFileSync(zipFileName).toString("base64");
	} catch(err) {
	    framework.servicelog("Failed to load zipfile: " + err);
	    framework.setStatustoClient(cookie, "zipfile load failure!");
	    return;
	}
	var sendable = { type: "zipUpload",
			 content: zipFile };
	framework.sendCipherTextToClient(cookie, sendable);
	framework.servicelog("pushed email zipfile to client");
	framework.setStatustoClient(cookie, "OK");
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
	framework.servicelog("Error creating archive zipfile: " + JSON.stringify(err));
	return;
    });
    zipFileStream.on('close', function() {
	try {
	    fs.unlinkSync(archiveFileName);
	    var zipFile = fs.readFileSync(zipFileName).toString("base64");
	} catch(err) {
	    framework.servicelog("Failed to load zipfile: " + err);
	    framework.setStatustoClient(cookie, "zipfile load failure!");
	    return;
	}
	var sendable = { type: "zipUpload",
			 content: zipFile };
	framework.sendCipherTextToClient(cookie, sendable);
	framework.servicelog("pushed archive zipfile to client");
	framework.setStatustoClient(cookie, "OK");
    });
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


// database conversion and update

function updateDatabaseVersionTo_1() {
    var mainConfig = datastorage.read("main").main;
    var userConfig = datastorage.read("users").users;
    var companyConfig = datastorage.read("company").company;
    var customersConfig = datastorage.read("customers").customers;
    var invoicesConfig = datastorage.read("invoices").invoices;
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
    if(datastorage.write("users", { users: newUserConfig }) === false) {
	framework.servicelog("Updating user database failed");
	process.exit(1);
    } else {
	framework.servicelog("Updated user database to v.1");
    }

    var newAccessConfig = [];
    userConfig.forEach(function(u) {
	newAccessConfig.push({ username: u.username,
			       teams: u.applicationData.teams[0],
			       emailText: u.applicationData.emailText });
    });
    if(datastorage.write("access", { access: newAccessConfig }) === false) {
	framework.servicelog("Updating access database failed");
	process.exit(1);
    } else {
	framework.servicelog("Updated access database to v.1");
    }

    var newTeamsConfig = [];
    nextId = 1;
    companyConfig.forEach(function(c) {
	newTeamsConfig.push({ id: nextId++,
			      color: c.id,
			      name: c.name,
			      address: c.address,
			      bank: c.bankName,
			      iban: c.iban,
			      bic: c.bic });
    });
    if(datastorage.write("teams", { nextId: nextId, teams: newTeamsConfig }) === false) {
	framework.servicelog("Updating teams database failed");
	process.exit(1);
    } else {
	framework.servicelog("Updated teams database to v.1");
    }

    var newPlayersConfig = [];
    nextId = 1;
    customersConfig.forEach(function(c) {
	newPlayersConfig.push({ id: nextId++,
				name: c.name,
				address: c.address,
				detail: c.detail,
				email: c.email,
				reference: c.reference,
				team: c.team });
    });
    if(datastorage.write("players", { nextId: nextId, players: newPlayersConfig }) === false) {
	framework.servicelog("Updating players database failed");
	process.exit(1);
    } else {
	framework.servicelog("Updated players database to v.1");
    }

    var newInvoiceConfig = [];
    nextId = 1;
    datastorage.read("invoices").invoices.forEach(function(i) {
	newInvoiceConfig.push({ id: nextId++,
				description: i.description,
				price: i.price,
				user: i.user,
				vat: i.vat });
    });
    if(datastorage.write("invoices", { nextId: nextId, invoices: newInvoiceConfig }) === false) {
	framework.servicelog("Updating invoices database failed");
	process.exit(1);
    } else {
	framework.servicelog("Updated invoices database to v.1");
    }

    if(datastorage.write("main", { main: { version: 1,
					    port: mainConfig.port,
					    siteFullUrl: mainConfig.siteFullUrl,
					    emailVerification: false,
					   defaultLanguage: mainConfig.language } } ) === false) {
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
    var mainConfig = datastorage.read("main").main;
    if(mainConfig.version === undefined) {
	mainConfig.version = 0;
	datastorage.initialize("customers", { nextId: 1, customers: [] }, true);
	datastorage.initialize("company", { nextId: 1, company: [] }, true);
    }
    datastorage.initialize("invoices", { nextId: 1, invoices: [] }, true);
    datastorage.initialize("teams", { nextId: 1, teams: [] }, true);
    datastorage.initialize("players", { nextId: 1, players: [] }, true);
    datastorage.initialize("access", { access: [] }, true);
    datastorage.initialize("archive", { nextId: 1, archive: [] }, true);

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

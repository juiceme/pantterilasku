var site = window.location.hostname;
var mySocket = new WebSocket("ws://" + site + ":" + WEBSOCK_PORT + "/");
var sessionPassword;

mySocket.onopen = function (event) {
    var sendable = {type:"clientStarted", content:"none"};
    mySocket.send(JSON.stringify(sendable));
    document.getElementById("myStatusField").value = "started";
};

mySocket.onmessage = function (event) {
    var receivable = JSON.parse(event.data);
    if(receivable.type == "statusData") {
        document.getElementById("myStatusField").value = receivable.content;
    }

    if(receivable.type == "loginView") {
	document.body.replaceChild(createLoginView(), document.getElementById("myDiv1"));
	document.body.replaceChild(createLoginHelpText(), document.getElementById("myHelpText"));
    }

    if(receivable.type == "loginChallenge") {
	var challenge = Aes.Ctr.decrypt(receivable.content, sessionPassword, 128);
	var cipheredResponce = Aes.Ctr.encrypt(challenge, sessionPassword, 128);
	sendToServer("loginResponse", cipheredResponce);
    }

    if(receivable.type == "createNewAccount") {
	var account = JSON.parse(Aes.Ctr.decrypt(receivable.content, sessionPassword, 128));
 	document.body.replaceChild(createNewAccountView(account), document.getElementById("myDiv1"));
    }

    if(receivable.type == "unpriviligedLogin") {
	var helpText = JSON.parse(Aes.Ctr.decrypt(receivable.content, sessionPassword, 128));
	document.body.replaceChild(createLogoutButton(),
				   document.getElementById("myLogoutButton"));
	document.body.replaceChild(createUnpriviligedView(helpText),
				   document.getElementById("myDiv1"));
	var helpTextDiv = document.createElement('div');
	helpTextDiv.id = "myHelpText"
	document.body.replaceChild(helpTextDiv, document.getElementById("myHelpText"));
    }

    if(receivable.type == "invoiceData") {
	var invoiceData = receivable.content;
	document.body.replaceChild(createLogoutButton(),
				   document.getElementById("myLogoutButton"));
	document.body.replaceChild(createUserView(invoiceData),
				   document.getElementById("myDiv1"));
	document.body.replaceChild(createUserHelpText(), document.getElementById("myHelpText"));
    }

    if(receivable.type == "pdfUpload") {
	var pdfData = atob(JSON.parse(Aes.Ctr.decrypt(receivable.content, sessionPassword, 128)));
	window.open("data:application/pdf," + escape(pdfData));
    }

    if(receivable.type == "zipUpload") {
	var zipData = atob(JSON.parse(Aes.Ctr.decrypt(receivable.content, sessionPassword, 128)));
	window.open("data:application/zip," + escape(zipData));
    }
}


// --------------

function createUnpriviligedView(helpText) {
    var fieldset = document.createElement('fieldsetset');
    var table = document.createElement('table');
    var row = document.createElement('tr');
    var cell = document.createElement('td');
    fieldset.appendChild(document.createElement('br'));
    cell.innerHTML = helpText;
    row.appendChild(cell);
    table.appendChild(row);
    fieldset.appendChild(table);
    fieldset.appendChild(document.createElement('br'));
    fieldset.id = "myDiv1";
    return fieldset;
}

function createUserView(invoiceData) {
    var invoiceData = JSON.parse(Aes.Ctr.decrypt(invoiceData, sessionPassword, 128));
    var fieldset = document.createElement('fieldsetset');
    fieldset.appendChild(document.createElement('br'));
    fieldset.appendChild(createCustomerTable(invoiceData));
    fieldset.appendChild(document.createElement('br'));
    fieldset.appendChild(createInvoiceTable(invoiceData));
    fieldset.appendChild(document.createElement('br'));
    fieldset.appendChild(createInvoiceButtons(invoiceData));
    fieldset.appendChild(document.createElement('br'));
    fieldset.appendChild(document.createElement('br'));
    fieldset.appendChild(createEmailText(invoiceData));
    fieldset.appendChild(document.createElement('br'));
    fieldset.appendChild(createSendButton(invoiceData));
    fieldset.appendChild(createDownloadButton(invoiceData));
    fieldset.appendChild(document.createElement('br'));
    fieldset.id= "myDiv1";
    return fieldset;
}

function createCustomerTable(invoiceData) {
    var clientCount = 0
    var table = document.createElement('table');
    var tableHeader = document.createElement('thead');
    var tableBody = document.createElement('tbody');
    table.id = "myCustomerTable";

    var hRow0 = tableHeader.insertRow(0);    
    var hRow1 = tableHeader.insertRow(1);        
    var hCell0 = hRow0.insertCell(0);
    var hCell1 = hRow0.insertCell(1);
    var hCell2 = hRow1.insertCell(0);
    hCell0.colSpan = "2";
    hCell0.rowSpan = "2";
    hCell1.colSpan = 6;
    hCell0.innerHTML = "<b>" + uiText(UI_TEXT_MAIN_F) + "</b>";
    hCell1.innerHTML = "<b>" + uiText(UI_TEXT_MAIN_G) + "</b>";
    for(var i=0; i<6; i++) {
	var hCellN = hRow1.insertCell(i);
	hCellN.innerHTML = "<b>" + (i+1) + "</b>";
	var checkBox = document.createElement('input');
	checkBox.type = "checkbox";
	checkBox.id = i;
	checkBox.value = "0"
	checkBox.onclick = function() {
	    toggleAllBoxes(this, invoiceData.customers);
	}
	hCellN.appendChild(checkBox);
    }
    var hCellN = hRow1.insertCell(6);
    hCellN.innerHTML = "<b>" + uiText(UI_TEXT_MAIN_H) + "</b>";
    invoiceData.customers.forEach(function(s) {
	var row = document.createElement('tr');
	var cell0 = document.createElement('td');
	cell0.appendChild(document.createTextNode(s.name));
	var cell1 = document.createElement('td');
	cell1.appendChild(document.createTextNode(s.team));
	row.appendChild(cell0);
	row.appendChild(cell1);
	for(var i=0; i<6; i++) {
	    var cellN = document.createElement('td');
	    var checkBox = document.createElement('input');
	    checkBox.type = "checkbox";
	    checkBox.id = "cb_" + clientCount + "_" + i;
	    checkBox.customer = clientCount;
	    checkBox.value = "0"
	    checkBox.onclick = function() {
		toggleSelectionList(this);
		togglePreviewLink(this);
	    }
	    cellN.appendChild(checkBox);
	    cellN.appendChild(createSelectionList(clientCount, i));
	    row.appendChild(cellN);
	}
	var cellD = document.createElement('td');
	var dueDateSelector = document.createElement('select');
	var dueDateOption1 = document.createElement('option');
	var dueDateOption2 = document.createElement('option');
	var dueDateOption3 = document.createElement('option');
	var dueDateOption4 = document.createElement('option');
	var dueDateOption5 = document.createElement('option');
	dueDateOption1.text = "heti"
	dueDateOption1.value = 0;
	dueDateSelector.add(dueDateOption1);
	dueDateOption2.text = "1 viikko"
	dueDateOption2.value = 7;
	dueDateSelector.add(dueDateOption2);
	dueDateOption3.text = "2 viikkoa"
	dueDateOption3.value = 14;
	dueDateSelector.add(dueDateOption3);
	dueDateOption4.text = "3 viikkoa"
	dueDateOption4.value = 21;
	dueDateSelector.add(dueDateOption4);
	dueDateOption5.text = "4 viikkoa"
	dueDateOption5.value = 28;
	dueDateSelector.add(dueDateOption5);
	dueDateSelector.id = "dd_" + clientCount;
	dueDateSelector.value = 14;
	cellD.appendChild(dueDateSelector);
	row.appendChild(cellD);
	var cellP = document.createElement('td');
	var previewLink = document.createElement('a');
	var previewText = document.createTextNode(uiText(UI_TEXT_MAIN_J));
	previewLink.appendChild(previewText);
	previewLink.id = "pl_" + clientCount;
	previewLink.number = clientCount;
	previewLink.onclick = function() { getPreviewPdf(this, invoiceData); }
	previewLink.title = "preview PDF";
	previewLink.href = "#";
	previewLink.style.visibility = "hidden";
	cellP.appendChild(previewLink);
	row.appendChild(cellP);
	tableBody.appendChild(row);
	clientCount++;
    });
    table.appendChild(tableHeader);
    table.appendChild(tableBody);
    return table;
}

function createSelectionList(clientCount, index) {
    var numberSelector = document.createElement('select');
    for(var i=1; i<10; i++) {
	var numberOption = document.createElement('option');
	numberOption.text = i;
	numberOption.value = i;
	numberSelector.add(numberOption);
    }
    numberSelector.style.visibility = "hidden";
    numberSelector.id = "ns_" + clientCount + "_" + index;
    return numberSelector;
}

function toggleAllBoxes(checkBox, customers) {
    var i=0;
    var state = document.getElementById(checkBox.id).checked;
    customers.forEach(function(s) {
	var subCheckBox = "cb_" + i + "_" + checkBox.id;
	var listId = "ns_" + i + "_" + checkBox.id;
	var linkId = "pl_" + i;
	var visibility;
	document.getElementById(subCheckBox).checked = state;
	if(state) { visibility = "visible"; } else { visibility = "hidden"; }
	document.getElementById(listId).style.visibility = visibility;
	document.getElementById(linkId).style.visibility = visibility;
	i++;
    });
    return false;
}

function toggleSelectionList(checkBox) {
    var listId = checkBox.id.replace("cb", "ns");
    var visibility;
    if(checkBox.checked) { visibility = "visible"; } else { visibility = "hidden"; }
    document.getElementById(listId).style.visibility = visibility;
    return false;
}

function togglePreviewLink(checkBox) {
    linkVisible = false;
    for(var i=0; i<6; i++) {
	if(document.getElementById("cb_" + checkBox.customer + "_" + i).checked == true) {
	    linkVisible = true;
	}
    }
    if(linkVisible) {
	document.getElementById("pl_" + checkBox.customer).style.visibility = "visible";
    } else {
	document.getElementById("pl_" + checkBox.customer).style.visibility = "hidden";
    }
}

function getPreviewPdf(link, invoiceData) {
    var selectedInvoices = [];
    for(var i=0; i<6; i++) {
	var checkBox = "cb_" + link.number + "_" + i;
	if(document.getElementById(checkBox).checked == true) {
	    var nSelection = document.getElementById("ns_" + link.number + "_" + i);
	    var nValue = parseInt(nSelection.options[nSelection.selectedIndex].value);
	    var iSelection = document.getElementById("is_" + i);
	    var iValue = parseInt(iSelection.options[iSelection.selectedIndex].value);
	    selectedInvoices.push({ item : iValue, count : nValue });
	}
    }

    var ddSelection = document.getElementById("dd_" + link.number);
    var ddValue = parseInt(ddSelection.options[ddSelection.selectedIndex].value);

    var clientSendable = { customer: link.number, invoices: selectedInvoices, dueDate: ddValue };
    var encryptedSendable = Aes.Ctr.encrypt(JSON.stringify(clientSendable), sessionPassword, 128);
    var sendable = { type: "getPdfPreview",
		     content : encryptedSendable };
    mySocket.send(JSON.stringify(sendable));
    return false;
}

function createInvoiceTable(invoiceData) {
    var table = document.createElement('table');
    var tableHeader = document.createElement('thead');
    var tableBody = document.createElement('tbody');
    var hRow = tableHeader.insertRow(0);    
    var hCell0 = hRow.insertCell(0);
    var hCell1 = hRow.insertCell(1);
    hCell0.innerHTML = "<b>" + uiText(UI_TEXT_MAIN_G) + "</b>";
    for(var i=0; i<6; i++) {
	var row = document.createElement('tr');
	var cell0 = document.createElement('td');
	cell0.appendChild(document.createTextNode(i+1));
	row.appendChild(cell0);
	var cell1 = document.createElement('td');
	var invoiceSelector = createInvoiceSelector(invoiceData.invoices);
	invoiceSelector.id = "is_" + i;
	invoiceSelector.value = i;
	cell1.appendChild(invoiceSelector)
	row.appendChild(cell1);
	table.appendChild(row);
    }
    table.appendChild(tableHeader);
    table.appendChild(tableBody);
    return table;
}

function createInvoiceSelector(invoices) {
    var invoiceSelector = document.createElement('select');

    for(i=0; i<invoices.length; i++) {
	var invoiceOption = document.createElement('option')
	invoiceOption.text = invoices[i].description;
	invoiceOption.value = i;
	invoiceSelector.add(invoiceOption);
    }
    return invoiceSelector;
}

function createEditInvoicesView(invoiceData) {
    var fieldset = document.createElement('fieldsetset');
    var acceptButton = document.createElement('button');
    var cancelButton = document.createElement('button');
    var table = document.createElement('table');
    var tableHeader = document.createElement('thead');
    var tableBody = document.createElement('tbody');
    var hRow = tableHeader.insertRow(0);    
    var hCell1 = hRow.insertCell(0);
    hCell1.innerHTML = "<b>" + uiText(UI_TEXT_EDIT_INVOICE_A) + "</b>";
    var hCell2 = hRow.insertCell(1);
    hCell2.innerHTML = "<b>" + uiText(UI_TEXT_EDIT_INVOICE_B) + "</b>";
    var hCell3 = hRow.insertCell(2);
    hCell3.innerHTML = "<b>" + uiText(UI_TEXT_EDIT_INVOICE_C) + "</b>";
    var hCell4 = hRow.insertCell(3);
    hCell4.innerHTML = "<b>" + uiText(UI_TEXT_EDIT_INVOICE_D) + "</b>";
    var count = 1;
    invoiceData.invoices.forEach(function(c) {
	tableBody.appendChild(createInvoiceEditTableRow(count, invoiceData, c, false));
	count++;
    });
    var newInvoice = { description : "<item>", price : "<0.00>", vat : "<0.00>" };
    tableBody.appendChild(createInvoiceEditTableRow(count, invoiceData, newInvoice, true));
    table.appendChild(tableHeader);
    table.appendChild(tableBody);
    fieldset.appendChild(document.createElement('br'));
    fieldset.appendChild(table);
    fieldset.appendChild(document.createElement('br'));
    acceptButton.appendChild(document.createTextNode(uiText(UI_TEXT_EDIT_INVOICE_G)));
    acceptButton.onclick = function() { saveInvoiceDataEdit(invoiceData); }
    cancelButton.appendChild(document.createTextNode(uiText(UI_TEXT_EDIT_INVOICE_H)));
    cancelButton.onclick = function() { cancelInvoiceDataEdit(invoiceData); }
    fieldset.appendChild(acceptButton);
    fieldset.appendChild(cancelButton);
    fieldset.appendChild(document.createElement('br'));
    fieldset.id= "myDiv1";
    if(!havePrivilige(invoiceData.priviliges, "invoice-edit")) {
	acceptButton.disabled = true;
	alert(uiText(UI_TEXT_ALERT_A));
    }
    return fieldset;
}

function saveInvoiceDataEdit(invoiceData) {
    var count = 1;
    invoiceData.invoices.forEach(function(c) {
	c.user = invoiceData.user;
	c.description = document.getElementById("ti_" + count + "_description").value;
	c.price = document.getElementById("ti_" + count + "_price").value;
	c.vat =  document.getElementById("ti_" + count + "_vat").value;
	count++;
    });
    sendToServerEncrypted("saveInvoiceList", invoiceData);
}

function cancelInvoiceDataEdit(invoiceData) {
    sendToServerEncrypted("resetToMain", {});
}

function createInvoiceEditTableRow(count, invoiceData, invoice, lastRow) {
    var row = document.createElement('tr');

    var cell0 = document.createElement('td');
    cell0.appendChild(document.createTextNode(count));
    row.appendChild(cell0);

    var cell1 = document.createElement('td');
    var txtA1 = document.createElement("textarea");
    txtA1.id = "ti_" + count + "_description";
    txtA1.setAttribute('cols', 30);
    txtA1.setAttribute('rows', 1);
    txtA1.value = invoice.description;
    cell1.appendChild(txtA1);
    row.appendChild(cell1);

    var cell2 = document.createElement('td');
    var txtA2 = document.createElement("textarea");
    txtA2.id = "ti_" + count + "_price";
    txtA2.setAttribute('cols', 30);
    txtA2.setAttribute('rows', 1);
    txtA2.value = invoice.price;
    cell2.appendChild(txtA2);
    row.appendChild(cell2);

    var cell3 = document.createElement('td');
    var txtA3 = document.createElement("textarea");
    txtA3.id = "ti_" + count + "_vat";
    txtA3.setAttribute('cols', 25);
    txtA3.setAttribute('rows', 1);
    txtA3.value = invoice.vat;
    cell3.appendChild(txtA3);
    row.appendChild(cell3);

    var cell4 = document.createElement('td');
    if(lastRow) {
	var addButton = document.createElement("button");
	addButton.appendChild(document.createTextNode(uiText(UI_TEXT_EDIT_INVOICE_E)));
	addButton.id = count;
	addButton.onclick = function() { createInvoiceToList(invoiceData, this); }
	cell4.appendChild(addButton);
    } else {
	var deleteButton = document.createElement("button");
	deleteButton.appendChild(document.createTextNode(uiText(UI_TEXT_EDIT_INVOICE_F)));
	deleteButton.id = count;
	deleteButton.onclick = function() { deleteInvoiceFromList(invoiceData, this); }
	cell4.appendChild(deleteButton);
    }
    row.appendChild(cell4);

    return row;
}

function deleteInvoiceFromList(invoiceData, button) {
    newInvoices = invoiceData.invoices.map(function(a,b) {
	if(b != (button.id - 1)) { return a; }
    }).filter(function(s){ return s; });
    invoiceData.invoices = newInvoices;
    document.body.replaceChild(createEditInvoicesView(invoiceData),
			       document.getElementById("myDiv1"));
    return false;
}

function createInvoiceToList(invoiceData, button) {
    var newInvoice = { description : document.getElementById("ti_" + button.id + "_description").value,
		       price : document.getElementById("ti_" + button.id + "_price").value,
		       vat : document.getElementById("ti_" + button.id + "_vat").value };
    invoiceData.invoices.push(newInvoice);
    document.body.replaceChild(createEditInvoicesView(invoiceData),
			       document.getElementById("myDiv1"));
    return false;
}


function createEmailText(invoiceData) {
    var table = document.createElement('table');
    var tableHeader = document.createElement('thead');
    var tableBody = document.createElement('tbody');
    var textArea = document.createElement("textarea");
    textArea.id = "myEmailTextArea"
    textArea.setAttribute('cols',80);
    textArea.setAttribute('rows', 5);
    textArea.value = invoiceData.emailText;

    var hRow = tableHeader.insertRow(0);    
    var hCell = hRow.insertCell(0);
    hCell.innerHTML = "<b>" + uiText(UI_TEXT_MAIN_I) + "</b>";
    var row = document.createElement('tr');
    var cell1 = document.createElement('td');
    cell1.appendChild(textArea);

    row.appendChild(cell1);
    tableBody.appendChild(row);
    table.appendChild(tableHeader);
    table.appendChild(tableBody);
    return table;
}

function createEditCustomersView(invoiceData) {
    var fieldset = document.createElement('fieldsetset');
    var acceptButton = document.createElement('button');
    var cancelButton = document.createElement('button');
    var table = document.createElement('table');
    var tableHeader = document.createElement('thead');
    var tableBody = document.createElement('tbody');
    var hRow = tableHeader.insertRow(0);
    var hCell1 = hRow.insertCell(0);
    hCell1.innerHTML = "<b>No.</b>";
    var hCell2 = hRow.insertCell(1);
    hCell2.innerHTML = "<b>" + uiText(UI_TEXT_EDIT_CUSTOMER_A) + "</b>";
    var hCell3 = hRow.insertCell(2);
    hCell3.innerHTML = "<b>" + uiText(UI_TEXT_EDIT_CUSTOMER_B) + "</b>";
    var hCell4 = hRow.insertCell(3);
    hCell4.innerHTML = "<b>" + uiText(UI_TEXT_EDIT_CUSTOMER_C) + "</b>";
    var hCell5 = hRow.insertCell(4);
    hCell5.innerHTML = "<b>" + uiText(UI_TEXT_EDIT_CUSTOMER_D) + "</b>";
    var hCell6 = hRow.insertCell(5);
    hCell6.innerHTML = "<b>" + uiText(UI_TEXT_EDIT_CUSTOMER_E) + "</b>";
    var hCell7 = hRow.insertCell(6);
    hCell7.innerHTML = "<b>" + uiText(UI_TEXT_EDIT_CUSTOMER_F) + "</b>";
    var count = 1;
    invoiceData.customers.forEach(function(c) {
	tableBody.appendChild(createCustomerEditTableRow(count, invoiceData, c, false));
	count++;
    });
    var newCustomer = { name : "<name>", address : "<address>", detail : "<detail>", email : "<name@host>", reference : "<00000>", team : invoiceData.teams[0] };
    tableBody.appendChild(createCustomerEditTableRow(count, invoiceData, newCustomer, true));
    table.appendChild(tableHeader);
    table.appendChild(tableBody);
    
    fieldset.appendChild(document.createElement('br'));
    fieldset.appendChild(table);
    fieldset.appendChild(document.createElement('br'));
    acceptButton.appendChild(document.createTextNode(uiText(UI_TEXT_EDIT_CUSTOMER_I)));
    acceptButton.onclick = function() { saveCustomerDataEdit(invoiceData); }
    cancelButton.appendChild(document.createTextNode(uiText(UI_TEXT_EDIT_CUSTOMER_J)));
    cancelButton.onclick = function() { cancelCustomerDataEdit(invoiceData); }
    fieldset.appendChild(acceptButton);
    fieldset.appendChild(cancelButton);
    fieldset.appendChild(document.createElement('br'));
    fieldset.id= "myDiv1";
    if(!havePrivilige(invoiceData.priviliges, "customer-edit")) {
	acceptButton.disabled = true;
	alert(uiText(UI_TEXT_ALERT_A));
    }
    return fieldset;
}

function createCustomerEditTableRow(count, invoiceData, customer, lastRow) {
    var row = document.createElement('tr');

    var cell0 = document.createElement('td');
    cell0.appendChild(document.createTextNode(count));
    row.appendChild(cell0);

    var cell1 = document.createElement('td');
    var txtA1 = document.createElement("textarea");
    txtA1.id = "ta_" + count + "_name";
    txtA1.setAttribute('cols', 30);
    txtA1.setAttribute('rows', 1);
    txtA1.value = customer.name;
    cell1.appendChild(txtA1);
    row.appendChild(cell1);

    var cell2 = document.createElement('td');
    var txtA2 = document.createElement("textarea");
    txtA2.id = "ta_" + count + "_address";
    txtA2.setAttribute('cols', 30);
    txtA2.setAttribute('rows', 1);
    txtA2.value = customer.address;
    cell2.appendChild(txtA2);
    row.appendChild(cell2);

    var cell3 = document.createElement('td');
    var txtA3 = document.createElement("textarea");
    txtA3.id = "ta_" + count + "_detail";
    txtA3.setAttribute('cols', 30);
    txtA3.setAttribute('rows', 1);
    txtA3.value = customer.detail;
    cell3.appendChild(txtA3);
    row.appendChild(cell3);

    var cell4 = document.createElement('td');
    var txtA4 = document.createElement("textarea");
    txtA4.id = "ta_" + count + "_email";
    txtA4.setAttribute('cols', 30);
    txtA4.setAttribute('rows', 1);
    txtA4.value = customer.email;
    cell4.appendChild(txtA4);
    row.appendChild(cell4);

    var cell5 = document.createElement('td');
    var txtA5 = document.createElement("textarea");
    txtA5.id = "ta_" + count + "_reference";
    txtA5.setAttribute('cols', 25);
    txtA5.setAttribute('rows', 1);
    txtA5.value = customer.reference;
    cell5.appendChild(txtA5);
    row.appendChild(cell5);

    var cell6 = document.createElement('td');
    var teamSelector = createTeamSelector(invoiceData.teams, customer.team, count);
    teamSelector.id = "ta_" + count + "_teamSelector";
    cell6.appendChild(teamSelector);
    row.appendChild(cell6);

    var cell7 = document.createElement('td');
    if(lastRow) {
	var addButton = document.createElement("button");
	addButton.appendChild(document.createTextNode(uiText(UI_TEXT_EDIT_CUSTOMER_G)));
	addButton.id = count;
	addButton.onclick = function() { createCustomerToList(invoiceData, this); }
	cell7.appendChild(addButton);
    } else {
	var deleteButton = document.createElement("button");
	deleteButton.appendChild(document.createTextNode(uiText(UI_TEXT_EDIT_CUSTOMER_H)));
	deleteButton.id = count;
	deleteButton.onclick = function() { deleteCustomerFromList(invoiceData, this); }
	cell7.appendChild(deleteButton);
    }
    row.appendChild(cell7);

    return row;
}

function createTeamSelector(teams, defaultTeam, id) {
    var teamSelector = document.createElement('select');

    teams.forEach(function(t) {
	var teamOption = document.createElement('option')
	teamOption.text = t;
	teamOption.value = t;
	teamSelector.add(teamOption);
    });
    teamSelector.value = defaultTeam;
    teamSelector.id = "ts_" + id;
    return teamSelector;
}

function getSelectedTeam(id) {
    teamSelector = document.getElementById(id);
    return teamSelector.options[teamSelector.selectedIndex].value;
}

function deleteCustomerFromList(invoiceData, button) {
    newCustomers = invoiceData.customers.map(function(a,b) {
	if(b != (button.id - 1)) { return a; }
    }).filter(function(s){ return s; });
    invoiceData.customers = newCustomers;
    document.body.replaceChild(createEditCustomersView(invoiceData),
			       document.getElementById("myDiv1"));
    return false;
}

function createCustomerToList(invoiceData, button) {
    var newCustomer = { name : document.getElementById("ta_" + button.id + "_name").value,
			address : document.getElementById("ta_" + button.id + "_address").value,
			detail : document.getElementById("ta_" + button.id + "_detail").value,
			email : document.getElementById("ta_" + button.id + "_email").value,
			reference : document.getElementById("ta_" + button.id + "_reference").value,
			team : getSelectedTeam("ta_" + button.id + "_teamSelector") };
    invoiceData.customers.push(newCustomer);
    document.body.replaceChild(createEditCustomersView(invoiceData),
			       document.getElementById("myDiv1"));
    return false;
}

function createInvoiceButtons(invoiceData) {
    var fieldset = document.createElement('fieldsetset');
    var editCustomersButton = document.createElement('button');
    var editInvoicessButton = document.createElement('button');
    editCustomersButton.appendChild(document.createTextNode(uiText(UI_TEXT_MAIN_B)));
    editCustomersButton.onclick = function() { editCustomers(invoiceData); }
    editInvoicessButton.appendChild(document.createTextNode(uiText(UI_TEXT_MAIN_C)));
    editInvoicessButton.onclick = function() { editInvoicess(invoiceData); }
    fieldset.appendChild(editCustomersButton);
    fieldset.appendChild(editInvoicessButton);
    return fieldset;
}

function createSendButton(invoiceData) {
    var sendEmailButton = document.createElement('button');
    sendEmailButton.appendChild(document.createTextNode(uiText(UI_TEXT_MAIN_D)));
    sendEmailButton.onclick = function() { sendAllEmails(invoiceData); }
    return sendEmailButton;
}

function createDownloadButton(invoiceData) {
    var downloadButton = document.createElement('button');
    downloadButton.appendChild(document.createTextNode(uiText(UI_TEXT_MAIN_E)));
    downloadButton.onclick = function() { downloadInvoices(invoiceData); }
    return downloadButton;
}

function editCustomers(invoiceData) {
    document.body.replaceChild(createEditCustomersView(invoiceData),
			       document.getElementById("myDiv1"));
    return false;
}

function editInvoicess(invoiceData) {
    document.body.replaceChild(createEditInvoicesView(invoiceData),
			       document.getElementById("myDiv1"));
    return false;
}

function saveCustomerDataEdit(invoiceData) {
    var count = 1;
    invoiceData.customers.forEach(function(c) {
	c.name = document.getElementById("ta_" + count + "_name").value;
	c.address = document.getElementById("ta_" + count + "_address").value;
	c.detail = document.getElementById("ta_" + count + "_detail").value;
	c.email = document.getElementById("ta_" + count + "_email").value;
	c.reference =  document.getElementById("ta_" + count + "_reference").value;
	c.team = getSelectedTeam("ta_" + count + "_teamSelector");
	count++;
    });
    sendToServerEncrypted("saveCustomerList", invoiceData);
}

function cancelCustomerDataEdit(invoiceData) {
    sendToServerEncrypted("resetToMain", {});
}

function createSendableList(invoiceData) {
    var invoices = [];
    var i = 0;
    invoiceData.customers.forEach(function(s) {
	var customer = { id:i, invoices: [] };
	var invoiceExists = false;
	for(var j=0; j<6; j++) {
	    var checkBox = "cb_" + i + "_" + j;
	    if(document.getElementById(checkBox).checked == true) {
		invoiceExists = true;
		var nSelection = document.getElementById("ns_" + i + "_" + j);
		var nValue = parseInt(nSelection.options[nSelection.selectedIndex].value);
		var iSelection = document.getElementById("is_" + j);
		var iValue = parseInt(iSelection.options[iSelection.selectedIndex].value);
		customer.invoices.push({ item : iValue, count : nValue });
	    }
	}
	if(invoiceExists) {
	    var ddSelection = document.getElementById("dd_" + i);
	    customer.dueDate = parseInt(ddSelection.options[ddSelection.selectedIndex].value);
	    invoices.push(customer);
	}

	i++;
    });
    return invoices;
}

function sendAllEmails(invoiceData) {
    if(!havePrivilige(invoiceData.priviliges, "email-send")) {
	alert(uiText(UI_TEXT_ALERT_B));
	return false;
    }

    var invoices = createSendableList(invoiceData);
    if(invoices.length === 0) {
	alert(uiText(UI_TEXT_ALERT_C));
	return false;
    }

    var confirmText = uiText(UI_TEXT_ALERT_D) + " " + invoices.length + " " + uiText(UI_TEXT_ALERT_E);
    if (confirm(confirmText)) {
	var clientSendable = { emailText: document.getElementById("myEmailTextArea").value,
			       invoices: invoices };
	var encryptedSendable = Aes.Ctr.encrypt(JSON.stringify(clientSendable), sessionPassword, 128);
	var sendable = { type: "sendInvoices",
			 content : encryptedSendable };
	mySocket.send(JSON.stringify(sendable));
	document.documentElement.scrollTop = 0;
    } else {
	// Do nothing!
    }

    return false;
}

function downloadInvoices(invoiceData) {
    var invoices = createSendableList(invoiceData);
    if(invoices.length === 0) {
	alert(uiText(UI_TEXT_ALERT_C));
	return false;
    }

    var clientSendable = { invoices: invoices };
    var encryptedSendable = Aes.Ctr.encrypt(JSON.stringify(clientSendable), sessionPassword, 128);
    var sendable = { type: "downloadInvoices",
		     content : encryptedSendable };
    mySocket.send(JSON.stringify(sendable));
    document.documentElement.scrollTop = 0;

    return false;
}

function havePrivilige(priviligeList, privilige) {
    if(priviligeList.indexOf(privilige) < 0) { return false; }
    else { return true; }
}

// ----------------

function uiText(text) {
    return decodeURIComponent(escape(text));
}

function createLoginView() {
    var table = document.createElement('table');
    var tHeader = document.createElement('thead');
    var tBody = document.createElement('tbody');
    var hRow = document.createElement('tr');
    var hCell = document.createElement('td');
    var bRow1 = document.createElement('tr');
    var bCell1a = document.createElement('td');
    var bCell1b = document.createElement('td');
    var bRow2 = document.createElement('tr');
    var bCell2a = document.createElement('td');
    var bCell2b = document.createElement('td');
    var bRow3 = document.createElement('tr');
    var bCell3a = document.createElement('td');
    var bCell3b = document.createElement('td');
    var bRow4 = document.createElement('tr');
    var bCell4a = document.createElement('td');
    var bCell4b = document.createElement('td');
    var bRow5 = document.createElement('tr');
    var bCell5a = document.createElement('td');
    var bCell5b = document.createElement('td');

    var usernameField = document.createElement("input");
    var passwordField = document.createElement("input");
    var loginButton = document.createElement("button");
    var createAccountButton = document.createElement("button");

    usernameField.name="username";
    usernameField.type="text"
    passwordField.name="password";
    passwordField.type="password";

    hCell.colSpan = "2";
    hCell.appendChild(document.createTextNode(uiText(UI_TEXT_LOGIN_A)));
    hRow.appendChild(hCell);
    setElementStyle(hCell);
    tHeader.appendChild(hRow);
    table.appendChild(tHeader);

    bCell1a.style.border = "solid #ffffff";
    bCell1b.style.border = "solid #ffffff";
    setElementStyle(bCell2a);
    setElementStyle(bCell2b);
    setElementStyle(bCell3a);
    setElementStyle(bCell3b);
    bCell4a.style.border = "solid #ffffff";
    bCell4b.style.border = "solid #ffffff";
    setElementStyle(bCell5a);
    setElementStyle(bCell5b);

    bCell1a.appendChild(document.createTextNode(" "));
    bCell2a.appendChild(document.createTextNode(uiText(UI_TEXT_LOGIN_B) + ": "));
    bCell2b.appendChild(usernameField);
    bCell3a.appendChild(document.createTextNode(uiText(UI_TEXT_LOGIN_C) + ": "));
    bCell3b.appendChild(passwordField);
    bCell4a.appendChild(document.createTextNode(" "));

    loginButton.appendChild(document.createTextNode(uiText(UI_TEXT_LOGIN_D)));
    loginButton.onclick = function() { sendLogin(usernameField.value, passwordField.value); }
    createAccountButton.appendChild(document.createTextNode(uiText(UI_TEXT_LOGIN_E)));
    createAccountButton.onclick = function() { createAccountQuery(); }

    bCell5a.appendChild(loginButton);
    bCell5b.appendChild(createAccountButton);

    bRow1.appendChild(bCell1a);
    bRow1.appendChild(bCell1b);
    bRow2.appendChild(bCell2a);
    bRow2.appendChild(bCell2b);
    bRow3.appendChild(bCell3a);
    bRow3.appendChild(bCell3b);
    bRow4.appendChild(bCell4a);
    bRow4.appendChild(bCell4b);
    bRow5.appendChild(bCell5a);
    bRow5.appendChild(bCell5b);

    tBody.appendChild(bRow1);
    tBody.appendChild(bRow2);
    tBody.appendChild(bRow3);
    tBody.appendChild(bRow4);
    tBody.appendChild(bRow5);

    table.appendChild(tBody);
    table.id = "myDiv1";

    return table;
}

function createLoginHelpText() {
    var helpTextBox = document.createElement("fieldset");
    helpTextBox.appendChild(document.createTextNode(decodeURIComponent(escape(HELPTEXT_LOGIN_A))))
    helpTextBox.appendChild(document.createElement("br"));
    helpTextBox.appendChild(document.createElement("br"));
    helpTextBox.appendChild(document.createTextNode(decodeURIComponent(escape(HELPTEXT_LOGIN_B))))
    helpTextBox.appendChild(document.createElement("br"));
    helpTextBox.appendChild(document.createElement("br"));
    helpTextBox.appendChild(document.createTextNode(decodeURIComponent(escape(HELPTEXT_LOGIN_C))))
    helpTextBox.id = "myHelpText";

    return helpTextBox;
}

function createEmailHelpText() {
    var helpTextBox = document.createElement("fieldset");
    helpTextBox.appendChild(document.createTextNode(decodeURIComponent(escape(HELPTEXT_EMAIL_A))))
    helpTextBox.appendChild(document.createElement("br"));
    helpTextBox.appendChild(document.createElement("br"));
    helpTextBox.appendChild(document.createTextNode(decodeURIComponent(escape(HELPTEXT_EMAIL_B))))
    helpTextBox.id = "myHelpText";
    return helpTextBox;
}

function createUserHelpText() {
    var helpTextBox = document.createElement("fieldset");
    helpTextBox.appendChild(document.createTextNode(decodeURIComponent(escape(HELPTEXT_USER_A))))
    helpTextBox.appendChild(document.createElement("br"));
    helpTextBox.appendChild(document.createElement("br"));
    helpTextBox.appendChild(document.createTextNode(decodeURIComponent(escape(HELPTEXT_USER_B))))
    helpTextBox.appendChild(document.createElement("br"));
    helpTextBox.appendChild(document.createElement("br"));
    helpTextBox.appendChild(document.createTextNode(decodeURIComponent(escape(HELPTEXT_USER_C))))
    helpTextBox.appendChild(document.createElement("br"));
    helpTextBox.appendChild(document.createElement("br"));
    helpTextBox.appendChild(document.createTextNode(decodeURIComponent(escape(HELPTEXT_USER_D))))
    helpTextBox.id = "myHelpText";

    return helpTextBox;
}

function createEmailView() {
    var table = document.createElement('table');
    var tHeader = document.createElement('thead');
    var tBody = document.createElement('tbody');
    var hRow = document.createElement('tr');
    var hCell = document.createElement('td');
    var bRow1 = document.createElement('tr');
    var bCell1a = document.createElement('td');
    var bRow2 = document.createElement('tr');
    var bCell2a = document.createElement('td');
    var bCell2b = document.createElement('td');
    var bRow3 = document.createElement('tr');
    var bCell3a = document.createElement('td');
    var bRow4 = document.createElement('tr');
    var bCell4a = document.createElement('td');
    var bRow5 = document.createElement('tr');
    var bCell5a = document.createElement('td');
    var bCell5b = document.createElement('td');
    var bRow6 = document.createElement('tr');
    var bCell6a = document.createElement('td');

    var emailField = document.createElement("input");
    var validateField = document.createElement("input");
    var confirmButton = document.createElement("button");
    var validateButton = document.createElement("button");

    emailField.name="email";
    validateField.name="validate";

    hCell.colSpan = "2";
    hCell.appendChild(document.createTextNode(uiText(UI_TEXT_EMAIL_A)));
    hRow.appendChild(hCell);
    setElementStyle(hCell);
    tHeader.appendChild(hRow);
    table.appendChild(tHeader);

    bCell1a.style.border = "solid #ffffff";
    bRow1.style.border = "solid #ffffff";
    setElementStyle(bCell2a);
    setElementStyle(bCell2b);
    setElementStyle(bCell3a);
    bRow3.style.border = "solid #ffffff";
    bCell4a.style.border = "solid #ffffff";
    bRow4.style.border = "solid #ffffff";
    setElementStyle(bCell5a);
    setElementStyle(bCell5b);
    setElementStyle(bCell6a);
    bRow6.style.border = "solid #ffffff";

    bCell2a.appendChild(document.createTextNode(uiText(UI_TEXT_EMAIL_B) + ": "));
    bCell2b.appendChild(emailField);

    confirmButton.appendChild(document.createTextNode(uiText(UI_TEXT_EMAIL_D)));
    confirmButton.onclick = function() { sendConfirmationEmail(emailField.value); }
    bCell3a.appendChild(confirmButton);

    bCell5a.appendChild(document.createTextNode(uiText(UI_TEXT_EMAIL_C) + ": "));
    bCell5b.appendChild(validateField);
    validateButton.appendChild(document.createTextNode(uiText(UI_TEXT_EMAIL_E)));
    validateButton.onclick = function() { sendValidationCode(validateField.value); }
    bCell6a.appendChild(validateButton);

    bRow1.appendChild(bCell1a);
    bRow2.appendChild(bCell2a);
    bRow2.appendChild(bCell2b);
    bRow3.appendChild(bCell3a);
    bRow4.appendChild(bCell4a);
    bRow5.appendChild(bCell5a);
    bRow5.appendChild(bCell5b);
    bRow6.appendChild(bCell6a);

    tBody.appendChild(bRow1);
    tBody.appendChild(bRow2);
    tBody.appendChild(bRow3);
    tBody.appendChild(bRow4);
    tBody.appendChild(bRow5);
    tBody.appendChild(bRow6);

    table.appendChild(tBody);
    table.id= "myDiv1";

    return table;
}

function createNewAccountView(account) {
    var table = document.createElement('table');
    var tHeader = document.createElement('thead');
    var tBody = document.createElement('tbody');
    var hRow = document.createElement('tr');
    var hCell = document.createElement('td');
    var bRow1 = document.createElement('tr');
    var bCell1a = document.createElement('td');
    var bCell1b = document.createElement('td');
    var bRow2 = document.createElement('tr');
    var bCell2a = document.createElement('td');
    var bCell2b = document.createElement('td');
    var bRow3 = document.createElement('tr');
    var bCell3a = document.createElement('td');
    var bCell3b = document.createElement('td');
    var bRow4 = document.createElement('tr');
    var bCell4a = document.createElement('td');
    var bCell4b = document.createElement('td');
    var bRow5 = document.createElement('tr');
    var bCell5a = document.createElement('td');
    var bCell5b = document.createElement('td');
    var bRow6 = document.createElement('tr');
    var bCell6a = document.createElement('td');
    var bCell6b = document.createElement('td');
    var bRow7 = document.createElement('tr');
    var bCell7a = document.createElement('td');
    var bCell7b = document.createElement('td');
    var bRow8 = document.createElement('tr');
    var bCell8a = document.createElement('td');
    var bCell8b = document.createElement('td');
    var bRow9 = document.createElement('tr');
    var bCell9a = document.createElement('td');
    var bCell9b = document.createElement('td');
    var bRow10 = document.createElement('tr');
    var bCell10a = document.createElement('td');
    var bCell10b = document.createElement('td');
    var bRow11 = document.createElement('tr');
    var bCell11a = document.createElement('td');
    var bCell11b = document.createElement('td');

    var usernameField = document.createElement("input");
    var realnameField = document.createElement("input");
    var emailField = document.createElement("input");
    var phoneField = document.createElement("input");
    var password1Field = document.createElement("input");
    var password2Field = document.createElement("input");
    var confirmButton = document.createElement("button");
    var confirmButtonText;

    usernameField.name="username";
    realnameField.name="realname";
    emailField.name="email";
    phoneField.name="phone";
    password1Field.name="password1";
    password1Field.type="password";
    password2Field.name="password2";
    password2Field.type="password";

    hCell.colSpan = "2";
    if(account.username) {
	usernameField.value = account.username;
	usernameField.disabled = true;
	hCell.appendChild(document.createTextNode(uiText(UI_TEXT_CONFIG_A)));
	confirmButtonText = document.createTextNode(uiText(UI_TEXT_CONFIG_I));
    } else {
	hCell.appendChild(document.createTextNode(uiText(UI_TEXT_CONFIG_B)));
 	confirmButtonText = document.createTextNode(uiText(UI_TEXT_CONFIG_J));
   }
    if(account.realname) { realnameField.value = account.realname;}
    if(account.email) { emailField.value = account.email; }
    if(account.phone) { phoneField.value = account.phone; }

    hRow.appendChild(hCell);
    setElementStyle(hCell);
    tHeader.appendChild(hRow);
    table.appendChild(tHeader);

    bCell1a.style.border = "solid #ffffff";
    bCell1b.style.border = "solid #ffffff";
    setElementStyle(bCell2a);
    setElementStyle(bCell2b);
    setElementStyle(bCell3a);
    setElementStyle(bCell3b);
    setElementStyle(bCell4a);
    setElementStyle(bCell4b);
    setElementStyle(bCell5a);
    setElementStyle(bCell5b);
    setElementStyle(bCell6a);
    setElementStyle(bCell6b);
    setElementStyle(bCell7a);
    setElementStyle(bCell7b);
    bCell8a.style.border = "solid #ffffff";
    bCell8b.style.border = "solid #ffffff";

    setElementStyle(bCell7a);
    setElementStyle(bCell7b);
    bCell8a.style.border = "solid #ffffff";
    bCell8b.style.border = "solid #ffffff";
    setElementStyle(bCell9a);
    setElementStyle(bCell9b);
    bCell10a.style.border = "solid #ffffff";
    bCell10b.style.border = "solid #ffffff";
    setElementStyle(bCell11a);
    setElementStyle(bCell11b);

    bCell1a.appendChild(document.createTextNode(" "));
    bCell2a.appendChild(document.createTextNode(uiText(UI_TEXT_CONFIG_C) + ": "));
    bCell2b.appendChild(usernameField);
    bCell3a.appendChild(document.createTextNode(uiText(UI_TEXT_CONFIG_D) + ": "));
    bCell3b.appendChild(realnameField);
    bCell4a.appendChild(document.createTextNode(uiText(UI_TEXT_CONFIG_E) + ": "));
    bCell4b.appendChild(emailField);
    bCell5a.appendChild(document.createTextNode(uiText(UI_TEXT_CONFIG_F) + ": "));
    bCell5b.appendChild(phoneField);
    bCell6a.appendChild(document.createTextNode(uiText(UI_TEXT_CONFIG_G) + ": "));
    bCell6b.appendChild(password1Field);
    bCell7a.appendChild(document.createTextNode(uiText(UI_TEXT_CONFIG_H) + ": "));
    bCell7b.appendChild(password2Field);
    bCell8a.appendChild(document.createTextNode(" "));

    confirmButton.appendChild(confirmButtonText);
    confirmButton.onclick = function() { sendConfirmAccount( { username: usernameField.value,
							       realname:realnameField.value,
							       email: emailField.value,
							       phone: phoneField.value,
							       passwd1: password1Field.value,
							       passwd2: password2Field.value } ); }
    bCell9a.appendChild(confirmButton);

    bRow1.appendChild(bCell1a);
    bRow1.appendChild(bCell1b);
    bRow2.appendChild(bCell2a);
    bRow2.appendChild(bCell2b);
    bRow3.appendChild(bCell3a);
    bRow3.appendChild(bCell3b);
    bRow4.appendChild(bCell4a);
    bRow4.appendChild(bCell4b);
    bRow5.appendChild(bCell5a);
    bRow5.appendChild(bCell5b);
    bRow6.appendChild(bCell6a);
    bRow6.appendChild(bCell6b);
    bRow7.appendChild(bCell7a);
    bRow7.appendChild(bCell7b);
    bRow8.appendChild(bCell8a);
    bRow8.appendChild(bCell8b);
    bRow9.appendChild(bCell9a);
    bRow9.appendChild(bCell9b);

    tBody.appendChild(bRow1);
    tBody.appendChild(bRow2);
    tBody.appendChild(bRow3);
    tBody.appendChild(bRow4);
    tBody.appendChild(bRow5);
    tBody.appendChild(bRow6);
    tBody.appendChild(bRow7);
    tBody.appendChild(bRow8);
    tBody.appendChild(bRow9);

    table.appendChild(tBody);
    table.id= "myDiv1";

    return table;
}

function createLogoutButton() {
    var button = document.createElement("button");  
    button.onclick = function() { logout(); }
    var text = document.createTextNode(uiText(UI_TEXT_MAIN_A));
    button.appendChild(text);
    button.id = "myLogoutButton";
    return button;
}

function logout() {
    div1 = document.createElement("div");
    document.body.replaceChild(div1, document.getElementById("myLogoutButton"));
    div1.id = "myLogoutButton";
    div2 = document.createElement("div");
    document.body.replaceChild(div2, document.getElementById("myDiv1"));
    div2.id = "myDiv1";

    var sendable = {type:"clientStarted", content:"none"};
    mySocket.send(JSON.stringify(sendable));
    document.getElementById("myStatusField").value = "started";
}

function sendLogin(username, password) {
    div = document.createElement('div');
    div.id = "myDiv1";
    document.body.replaceChild(div, document.getElementById("myDiv1"));
    sessionPassword = Sha1.hash(password + Sha1.hash(username).slice(0,4));
    sendToServer("userLogin", { username: Sha1.hash(username) });
}

function setElementStyle(element) {
    element.style.border = "solid #ffffff";
    element.style.padding = "0";
}

function createAccountQuery() {
    document.body.replaceChild(createEmailView(), document.getElementById("myDiv1"));
    document.getElementById("myStatusField").value = "Creating/Reseting account";
    document.body.replaceChild(createEmailHelpText(), document.getElementById("myHelpText"));
}

function checkEmailValidity(address) {
    var re = /\S+@\S+\.\S+/;
    return (re.test(address));
}

function checkUsernameValidity(name) {
    if(name.length === 0) {
	return false;
    }
    var re = /\s/g;
    return (!re.test(name));
}

function sendConfirmAccount(account) {
    if(!checkEmailValidity(account.email)) {
	document.getElementById("myStatusField").value = "Illegal email address";
	document.body.replaceChild(createNewAccountView(), document.getElementById("myDiv1"));
	return;
    }
    if(!checkUsernameValidity(account.username)) {
	document.getElementById("myStatusField").value = "Illegal username";
	document.body.replaceChild(createNewAccountView(), document.getElementById("myDiv1"));
	return;
    }
    if(account.passwd1 !== account.passwd2) {
	document.getElementById("myStatusField").value = "Passwords do not match";
	document.body.replaceChild(createNewAccountView(), document.getElementById("myDiv1"));
	return;
    }
    var sendable = { username: account.username,
		     realname: account.realname,
		     email: account.email,
		     phone: account.phone,
		     password: Sha1.hash(account.passwd1 + Sha1.hash(account.username).slice(0,4)) }; 
    document.getElementById("myStatusField").value = "Account query sent";
    div = document.createElement('div');
    div.id = "myDiv1";
    document.body.replaceChild(div, document.getElementById("myDiv1"));
    sendToServerEncrypted("createAccount", sendable);
}

function sendConfirmationEmail(email) {
    if(!checkEmailValidity(email)) {
	document.getElementById("myStatusField").value = "Illegal email address";
	document.body.replaceChild(createEmailView(), document.getElementById("myDiv1"));
	return;
    }
    sendToServer("confirmEmail", email);
}

function sendValidationCode(code) {
    sessionPassword = code.slice(8,24);
    var sendable = { email: code.slice(0,8),
		     challenge: Aes.Ctr.encrypt("clientValidating", sessionPassword, 128) };
    sendToServer("validateAccount", sendable);
}

function sendToServer(type, content) {
    var sendable = { type: type, content: content };
    mySocket.send(JSON.stringify(sendable));
}

function sendToServerEncrypted(type, content) {
    var sendable = { type: type,
		     content: Aes.Ctr.encrypt(JSON.stringify(content), sessionPassword, 128) };
    mySocket.send(JSON.stringify(sendable));
}

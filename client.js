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
}


// --------------


function createUserView(invoiceData) {
    var invoiceData = JSON.parse(Aes.Ctr.decrypt(invoiceData, sessionPassword, 128));
    var fieldset = document.createElement('fieldsetset');
    fieldset.appendChild(createCustomerTable(invoiceData));
    fieldset.appendChild(createInvoiceTable(invoiceData));
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
    hCell1.colSpan = invoiceData.invoices.length;
    hCell0.innerHTML = "<b>Customer</b>";
    hCell1.innerHTML = "<b>Invoices</b>";
    var i = 0;
    invoiceData.invoices.forEach(function(s) {
	var hCellN = hRow1.insertCell(i);
	hCellN.innerHTML = "<b>" + (i+1) + "</b>";
	var checkBox = document.createElement('input');
	checkBox.type = "checkbox";
	checkBox.id = i;
	checkBox.value = "0"
	checkBox.onclick = function() {
	    toggleAllBoxes(checkBox.id,
			   document.getElementById(checkBox.id).checked,
			   invoiceData.customers);
	}
	hCellN.appendChild(checkBox);
	i++;
    });
    invoiceData.customers.forEach(function(s) {
	var row = document.createElement('tr');
	var cell0 = document.createElement('td');
	cell0.appendChild(document.createTextNode(s.name));
	var cell1 = document.createElement('td');
	cell1.appendChild(document.createTextNode(s.team));
	row.appendChild(cell0);
	row.appendChild(cell1);
	var i = 0;
	while(i < invoiceData.invoices.length) {
	    var cellN = document.createElement('td');
	    var checkBox = document.createElement('input');
	    checkBox.type = "checkbox";
	    checkBox.id = "cb_" + clientCount + "_" + i;
	    checkBox.value = "0"
	    checkBox.onclick = function() {
		toggleSelectionList(this);
	    }
	    cellN.appendChild(checkBox);
	    cellN.appendChild(createSelectionList(clientCount, i));
	    row.appendChild(cellN);
	    i++;
	}
	var cellP = document.createElement('td');
	var previewLink = document.createElement('a');
	var previewText = document.createTextNode("preview PDF");
	previewLink.appendChild(previewText);
	previewLink.id = clientCount;
	previewLink.onclick = function() { getPreviewPdf(previewLink.id, invoiceData); }
	previewLink.title = "preview PDF";
	previewLink.href = "#";
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
    for(i = 1; i < 10; i++) {
	var numberOption = document.createElement('option');
	numberOption.text = i;
	numberOption.value = i;
	numberSelector.add(numberOption);
    }
    numberSelector.style.visibility = "hidden";
    numberSelector.id = "ns_" + clientCount + "_" + index;
    return numberSelector;
}

function toggleAllBoxes(index, state, customers) {
    var i=0;
    customers.forEach(function(s) {
	var checkBox = "cb_" + i + "_" + index;
	var listId = "ns_" + i + "_" + index;
	var visibility;
	document.getElementById(checkBox).checked = state;
	if(state) { visibility = "visible"; } else { visibility = "hidden"; }
	document.getElementById(listId).style.visibility = visibility;
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

function getPreviewPdf(id, invoiceData) {
    var selectedInvoices = [];
    var i = 0;
    while(i < invoiceData.invoices.length) {
	var checkBox = "cb_" + id + "_" + i;
	if(document.getElementById(checkBox).checked == true) {
	    var listId = "ns_" + id + "_" + i;
	    var selection = document.getElementById(listId);
	    var value = selection.options[selection.selectedIndex].value;
	    selectedInvoices.push({ item : i, count : value });
	}
	i++;
    }
    var clientSendable = { customer: id, invoices: selectedInvoices };
    var encryptedSendable = Aes.Ctr.encrypt(JSON.stringify(clientSendable), sessionPassword, 128);
    var sendable = { type: "getPdfPreview",
		     content : encryptedSendable };
    mySocket.send(JSON.stringify(sendable));
    return false;
}

function createInvoiceTable(invoiceData) {
    var table = document.createElement('table');
    return table;
}


// ----------------


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
    hCell.appendChild(document.createTextNode("Please login or create a new account;"));
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
    bCell2a.appendChild(document.createTextNode("username: "));
    bCell2b.appendChild(usernameField);
    bCell3a.appendChild(document.createTextNode("password: "));
    bCell3b.appendChild(passwordField);
    bCell4a.appendChild(document.createTextNode(" "));

    loginButton.appendChild(document.createTextNode("Login"));
    loginButton.onclick = function() { sendLogin(usernameField.value, passwordField.value); }
    createAccountButton.appendChild(document.createTextNode("Create Account / Reset Password"));
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
    hCell.appendChild(document.createTextNode("Creating or restoring account;"));
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

    bCell2a.appendChild(document.createTextNode("email: "));
    bCell2b.appendChild(emailField);

    confirmButton.appendChild(document.createTextNode("Send Email!"));
    confirmButton.onclick = function() { sendConfirmationEmail(emailField.value); }
    bCell3a.appendChild(confirmButton);

    bCell5a.appendChild(document.createTextNode("validation code: "));
    bCell5b.appendChild(validateField);
    validateButton.appendChild(document.createTextNode("Validate Account!"));
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

    usernameField.name="username";
    realnameField.name="realname";
    emailField.name="email";
    phoneField.name="phone";
    password1Field.name="password1";
    password1Field.type="password";
    password2Field.name="password2";
    password2Field.type="password";

    if(account.username) {
	usernameField.value = account.username;
	usernameField.disabled = true;
    }
    if(account.realname) { realnameField.value = account.realname;}
    if(account.email) { emailField.value = account.email; }
    if(account.phone) { phoneField.value = account.phone; }

    hCell.colSpan = "2";
    hCell.appendChild(document.createTextNode("Creating a new account;"));
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
    bCell2a.appendChild(document.createTextNode("username: "));
    bCell2b.appendChild(usernameField);
    bCell3a.appendChild(document.createTextNode("realname: "));
    bCell3b.appendChild(realnameField);
    bCell4a.appendChild(document.createTextNode("email: "));
    bCell4b.appendChild(emailField);
    bCell5a.appendChild(document.createTextNode("phone: "));
    bCell5b.appendChild(phoneField);
    bCell6a.appendChild(document.createTextNode("password: "));
    bCell6b.appendChild(password1Field);
    bCell7a.appendChild(document.createTextNode("verify passwd: "));
    bCell7b.appendChild(password2Field);
    bCell8a.appendChild(document.createTextNode(" "));

    confirmButton.appendChild(document.createTextNode(account.buttonText));
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
    var text = document.createTextNode("Logout");
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

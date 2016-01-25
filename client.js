<!DOCTYPE html>
<html>
<head>
<style>
  table, th, td { border:1px solid black; border-collapse: collapse; }
  th, td { padding: 10px; }
</style>
</head>
<body>
<form> status: <input type="text" id="myStatusField" value="" disabled></form>
<br>
<table id= "myCustomerTable"> </table>
<br>
<table id = "myInvoiceTable"> </table>
<br>
<button onclick="sendAllInvoices()">Send all invoices</button>

<script language="javascript" type="text/javascript">

  var site = window.location.hostname;
  var mySocket = new WebSocket("ws://" + site + ":8081/");
  var customerArray = [];
  var invoiceArray = [];

  mySocket.onopen = function (event) {
    var sendable = {type:"clientStarted"};
    mySocket.send(JSON.stringify(sendable));
    document.getElementById("myStatusField").value = "started";
  };

  mySocket.onmessage = function (event) {
    var receivable = JSON.parse(event.data);
    if(receivable.type == "statusData") {
      document.getElementById("myStatusField").value = receivable.content;
    }
    if(receivable.type == "invoiceData") {
      customerArray = receivable.content.customers;
      invoiceArray = receivable.content.invoices;
      document.body.replaceChild(createCustomerTable(),
				 document.getElementById("myCustomerTable"));
      document.body.replaceChild(createInvoiceTable(),
				 document.getElementById("myInvoiceTable"));
    }
    if(receivable.type == "pdfUpload") {
	pdfData = atob(receivable.content);
	window.open("data:application/pdf," + escape(pdfData)); 
    }
  }

function createCustomerTable() {
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
    hCell1.colSpan = invoiceArray.length;
    hCell0.innerHTML = "<b>Customer</b>";
    hCell1.innerHTML = "<b>Invoices</b>";

    var i = 0;
    while(i < (invoiceArray.length)) {
	var hCellN = hRow1.insertCell(i);
	hCellN.innerHTML = "<b>" + (i+1) + "</b>";
	i++;
    }
	
    customerArray.forEach(function(s) {
	var row = document.createElement('tr');
	var cell0 = document.createElement('td');
	cell0.appendChild(document.createTextNode(s.name));
	var cell1 = document.createElement('td');
	cell1.appendChild(document.createTextNode(s.team));
	row.appendChild(cell0);
	row.appendChild(cell1);

	var i = 0;
	while(i < invoiceArray.length) {
	    var cellN = document.createElement('td');
	    var checkbox = document.createElement('input');
	    checkbox.type = "checkbox";
	    checkbox.id = "cb_" + clientCount + "_" + i;
	    checkbox.value = "0"
	    cellN.appendChild(checkbox);
	    row.appendChild(cellN);
	    i++;
	}

	var cellP = document.createElement('td');
	var previewLink = document.createElement('a');
	var previewText = document.createTextNode("preview PDF");
	previewLink.appendChild(previewText);
	previewLink.id = clientCount;
	previewLink.onclick = function() { getPreviewPdf(previewLink.id); }
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

function createInvoiceTable() {
    var table = document.createElement('table');
    var tableHeader = document.createElement('thead');
    var tableBody = document.createElement('tbody');
    table.id = "myInvoiceTable";

    var hRow = tableHeader.insertRow(0);    
    var hCell = hRow.insertCell(0);
    hCell.innerHTML = "<b>Invoices</b>";

    var count = 1;
    invoiceArray.forEach(function(name) {
	var row = document.createElement('tr');
	var cell1 = document.createElement('td');
	cell1.appendChild(document.createTextNode(count));
	var cell2 = document.createElement('td');
	cell2.appendChild(document.createTextNode(name.description));
	row.appendChild(cell1);
	var cell3 = document.createElement('td');
	cell3.appendChild(document.createTextNode(name.n));
	row.appendChild(cell2);
	var cell4 = document.createElement('td');
	cell4.appendChild(document.createTextNode(name.price));
	row.appendChild(cell3);
	var cell5 = document.createElement('td');
	cell5.appendChild(document.createTextNode(name.vat));
	row.appendChild(cell4);
	tableBody.appendChild(row);
	count++;
    });

    table.appendChild(tableHeader);
    table.appendChild(tableBody);

    return table;
}

function getPreviewPdf(s) {
    var selectedInvoices = [];

    var i = 0;
    while(i < invoiceArray.length) {
	var checkBox = "cb_" + s + "_" + i;
	if(document.getElementById(checkBox).checked == true) {
	    selectedInvoices.push(i);
	}
	i++;
    }

    var sendable = {type:"getPdfPreview", customer:s, invoices:selectedInvoices};
    mySocket.send(JSON.stringify(sendable));

    return false;
}

function sendAllInvoices() {
    var invoices = [];

    var i = 0;
    customerArray.forEach(function(s) {
	var customer = { id:i, invoices: [] };
	var j = 0;
	var invoiceExists = false;
	while(j < invoiceArray.length) {
	    var checkBox = "cb_" + i + "_" + j;
	    if(document.getElementById(checkBox).checked == true) {
		invoiceExists = true;
		customer.invoices.push(j+1);
	    }
	    j++;
	}
	if(invoiceExists) { invoices.push(customer); }
	i++;
    });

    console.log(JSON.stringify(invoices));
    if (confirm('Are you sure you want to bulk email invoices?')) {
	var sendable = {type:"sendInvoices", invoices:invoices};
	mySocket.send(JSON.stringify(sendable));
    } else {
	// Do nothing!
    }
}

</script>

</body>
</html>

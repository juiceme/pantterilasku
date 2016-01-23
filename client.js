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
//      console.log(receivable.type);
//      console.log(receivable.content);
      customerArray = receivable.content.customers;
      invoiceArray = receivable.content.invoices;

      document.body.replaceChild(createCustomerTable(),
				 document.getElementById("myCustomerTable"));

      document.body.replaceChild(createInvoiceTable(),
				 document.getElementById("myInvoiceTable"));


    } else if(receivable.type == "3") {

	console.log(receivable.type);
	console.log(receivable.content);
	document.body.appendChild(createInvoiceTable(receivable.content));

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
	clientCount = clientCount + 1;
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
	    checkbox.name = "cb_" + clientCount + "_" + i;
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
    });

    table.appendChild(tableHeader);
    table.appendChild(tableBody);

    return table;
}

function getPreviewPdf(s) {
    console.log("clicked preview : " + s);

    var i = 0;
    while (i < invoiceArray.length) {
	console.log("baa");
	i++;
    }

// "cb_" + clientCount + "_" + i;

    var sendable = {type:"getPdfPreview", client:s};
    mySocket.send(JSON.stringify(sendable));
    return false;
}

function sendAllInvoices() {
    alert("WTF!");
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
	console.log(name);
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

</script>

</body>
</html>

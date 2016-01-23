<!DOCTYPE html>
<html>
<head>
<style>
  table, th, td { border:1px solid black; border-collapse: collapse; }
  th, td { padding: 10px; }
</style>
</head>
<body>
<script language="javascript" type="text/javascript">

  var sendable = {type:1, content:""};
  var site = window.location.hostname;
  var mySocket = new WebSocket("ws://" + site + ":8081/");
  var firstAccess = 0;
  mySocket.onopen = function (event) {
    mySocket.send("Here is some text that the server is urgently awaiting!");
    document.getElementById("myTextField").value = "start";
  };

  mySocket.onmessage = function (event) {
    var receivable = JSON.parse(event.data);
    if(receivable.type == "1") {
      document.getElementById("myTextField").value = receivable.content;
    } else if(receivable.type == "invoiceData") {
	console.log(receivable.type);
	console.log(receivable.content);
	document.body.appendChild(createTable1(receivable.content.customers,
					       receivable.content.invoices.length));


//      if(firstAccess === 0) {
//        firstAccess = 1;
//        document.body.appendChild(createTable1(receivable.content));
//      } else {
//        document.body.replaceChild(createTable1(receivable.content), document.getElementById("myCustomerTable"));
//      }
    } else if(receivable.type == "3") {

	console.log(receivable.type);
	console.log(receivable.content);
	document.body.appendChild(createTable2(receivable.content));

    }
  }

</script>

<form>
  time: <input type="text" id="myTextField" value="" disabled>
</form>

<button onclick="getPreviewPdf()">Click me</button>

<script language="javascript" type="text/javascript">

function createTable1(tableData, invoiceRows) {
    var clientCount = 0
    var table = document.createElement('table');
    var tableBody = document.createElement('tbody');
    table.id = "myCustomerTable";

    tableData.forEach(function(name) {
	clientCount = clientCount + 1;
	var row = document.createElement('tr');
	var cell1 = document.createElement('td');
	cell1.appendChild(document.createTextNode(name));
	row.appendChild(cell1);

	var i = 0;
	while ( i < invoiceRows) {
	    var cellN = document.createElement('td');
	    var checkbox = document.createElement('input');
	    checkbox.type = "checkbox";
	    checkbox.name = "cb_"+name;
	    checkbox.value = "0"
	    cellN.appendChild(checkbox);
	    row.appendChild(cellN);
	    i = i + 1;
	}

	var cellP = document.createElement('td');
	var previewLink = document.createElement('a');
	var previewText = document.createTextNode("preview PDF");
	previewLink.appendChild(previewText);
	previewLink.id = "pdfPreview" + clientCount;
	previewLink.onclick = function() { getPreviewPdf(previewLink.id); }
	previewLink.title = "preview PDF";
	previewLink.href = "#";
	cellP.appendChild(previewLink);
	row.appendChild(cellP);

	tableBody.appendChild(row);
    });

    table.appendChild(tableBody);

    return table;
}

function getPreviewPdf(s) {
    console.log("clicked preview : " + s);
    var sendable = {type:"getPdfPreview", content:s};
    mySocket.send(JSON.stringify(sendable));
    return false;
}


function createTable2(tableData) {
    var table = document.createElement('table');
    var tableBody = document.createElement('tbody');
    table.id = "myInvoiceTable";

    tableData.rivit.forEach(function(name) {
	console.log(name);
	var row = document.createElement('tr');
	var cell1 = document.createElement('td');
	cell1.appendChild(document.createTextNode(name.description));
	row.appendChild(cell1);
	var cell2 = document.createElement('td');
	cell2.appendChild(document.createTextNode(name.n));
	row.appendChild(cell2);
	var cell3 = document.createElement('td');
	cell3.appendChild(document.createTextNode(name.price));
	row.appendChild(cell3);
	var cell4 = document.createElement('td');
	cell4.appendChild(document.createTextNode(name.vat));
	row.appendChild(cell4);

	tableBody.appendChild(row);
    });

    table.appendChild(tableBody);

    return table;
}

</script>

</body>
</html>

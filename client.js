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
<div id = "mySendButton"> </div>

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
    if(receivable.type == "loginRequest") {
      var passwordHash = md5(window.prompt("Enter your password","") + receivable.content.salt);
      var reply = md5(passwordHash + receivable.content.challenge);
      var sendable = {type:"loginClient", content:reply}
      mySocket.send(JSON.stringify(sendable));
    }
    if(receivable.type == "invoiceData") {
      customerArray = receivable.content.customers;
      invoiceArray = receivable.content.invoices;
      document.body.replaceChild(createCustomerTable(),
				 document.getElementById("myCustomerTable"));
      document.body.replaceChild(createInvoiceTable(),
				 document.getElementById("myInvoiceTable"));
      document.body.replaceChild(createButton(),
				 document.getElementById("mySendButton"));
    }
    if(receivable.type == "pdfUpload") {
      var pdfData = atob(receivable.content);
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
    invoiceArray.forEach(function(s) {

	var hCellN = hRow1.insertCell(i);
	hCellN.innerHTML = "<b>" + (i+1) + "</b>";
	var checkBox = document.createElement('input');
	checkBox.type = "checkbox";
	checkBox.id = i;
	checkBox.value = "0"
	checkBox.onclick = function() { toggleAllBoxes(checkBox.id,
						       document.getElementById(checkBox.id).checked);
				      }
	hCellN.appendChild(checkBox);
	i++;
    });

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

function createButton() {
    var button = document.createElement("button");
    button.onclick = function() { sendAllInvoices(); }
    var text = document.createTextNode("Send all invoices");
    button.appendChild(text);
    return button;
}

function toggleAllBoxes(index, state) {
    var i=0;
    customerArray.forEach(function(s) {
	var checkBox = "cb_" + i + "_" + index;
	document.getElementById(checkBox).checked = state;
	i++;
    });
    return false;
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

    if (confirm('Are you sure you want to bulk email invoices?')) {
	var sendable = {type:"sendInvoices", invoices:invoices};
	mySocket.send(JSON.stringify(sendable));
    } else {
	// Do nothing!
    }
}

// md5 calculation from https://github.com/iReal/FastMD5/
!function(r){function n(r){for(var n="",t="",o=0,e=0,a=0,i=r.length;i>a;a++){var f=r.charCodeAt(a);128>f?e++:(t=2048>f?String.fromCharCode(f>>6|192,63&f|128):String.fromCharCode(f>>12|224,f>>6&63|128,63&f|128),e>o&&(n+=r.slice(o,e)),n+=t,o=e=a+1)}return e>o&&(n+=r.slice(o,i)),n}function t(r){var n,t;if(r+="",s=!1,v=w=r.length,w>63){for(o(r.substring(0,64)),i(A),s=!0,n=128;w>=n;n+=64)o(r.substring(n-64,n)),f(A);r=r.substring(n-64),w=r.length}for(d[0]=d[1]=d[2]=d[3]=d[4]=d[5]=d[6]=d[7]=d[8]=d[9]=d[10]=d[11]=d[12]=d[13]=d[14]=d[15]=0,n=0;w>n;n++)t=3&n,0===t?d[n>>2]=r.charCodeAt(n):d[n>>2]|=r.charCodeAt(n)<<C[t];return d[n>>2]|=h[3&n],n>55?(s?f(d):(i(d),s=!0),f([0,0,0,0,0,0,0,0,0,0,0,0,0,0,v<<3,0])):(d[14]=v<<3,void(s?f(d):i(d)))}function o(r){for(var n=16;n--;){var t=n<<2;A[n]=r.charCodeAt(t)+(r.charCodeAt(t+1)<<8)+(r.charCodeAt(t+2)<<16)+(r.charCodeAt(t+3)<<24)}}function e(r,o,e){t(o?r:n(r));var a=g[0];return u[1]=l[15&a],u[0]=l[15&(a>>=4)],u[3]=l[15&(a>>=4)],u[2]=l[15&(a>>=4)],u[5]=l[15&(a>>=4)],u[4]=l[15&(a>>=4)],u[7]=l[15&(a>>=4)],u[6]=l[15&(a>>=4)],a=g[1],u[9]=l[15&a],u[8]=l[15&(a>>=4)],u[11]=l[15&(a>>=4)],u[10]=l[15&(a>>=4)],u[13]=l[15&(a>>=4)],u[12]=l[15&(a>>=4)],u[15]=l[15&(a>>=4)],u[14]=l[15&(a>>=4)],a=g[2],u[17]=l[15&a],u[16]=l[15&(a>>=4)],u[19]=l[15&(a>>=4)],u[18]=l[15&(a>>=4)],u[21]=l[15&(a>>=4)],u[20]=l[15&(a>>=4)],u[23]=l[15&(a>>=4)],u[22]=l[15&(a>>=4)],a=g[3],u[25]=l[15&a],u[24]=l[15&(a>>=4)],u[27]=l[15&(a>>=4)],u[26]=l[15&(a>>=4)],u[29]=l[15&(a>>=4)],u[28]=l[15&(a>>=4)],u[31]=l[15&(a>>=4)],u[30]=l[15&(a>>=4)],e?u:u.join("")}function a(r,n,t,o,e,a,i){return n+=r+o+i,(n<<e|n>>>a)+t<<0}function i(r){c(0,0,0,0,r),g[0]=y[0]+1732584193<<0,g[1]=y[1]-271733879<<0,g[2]=y[2]-1732584194<<0,g[3]=y[3]+271733878<<0}function f(r){c(g[0],g[1],g[2],g[3],r),g[0]=y[0]+g[0]<<0,g[1]=y[1]+g[1]<<0,g[2]=y[2]+g[2]<<0,g[3]=y[3]+g[3]<<0}function c(r,n,t,o,e){var i,f;s?(r=a((t^o)&n^o,r,n,e[0],7,25,-680876936),o=a((n^t)&r^t,o,r,e[1],12,20,-389564586),t=a((r^n)&o^n,t,o,e[2],17,15,606105819),n=a((o^r)&t^r,n,t,e[3],22,10,-1044525330)):(r=e[0]-680876937,r=(r<<7|r>>>25)-271733879<<0,o=e[1]-117830708+(2004318071&r^-1732584194),o=(o<<12|o>>>20)+r<<0,t=e[2]-1126478375+((-271733879^r)&o^-271733879),t=(t<<17|t>>>15)+o<<0,n=e[3]-1316259209+((o^r)&t^r),n=(n<<22|n>>>10)+t<<0),r=a((t^o)&n^o,r,n,e[4],7,25,-176418897),o=a((n^t)&r^t,o,r,e[5],12,20,1200080426),t=a((r^n)&o^n,t,o,e[6],17,15,-1473231341),n=a((o^r)&t^r,n,t,e[7],22,10,-45705983),r=a((t^o)&n^o,r,n,e[8],7,25,1770035416),o=a((n^t)&r^t,o,r,e[9],12,20,-1958414417),t=a((r^n)&o^n,t,o,e[10],17,15,-42063),n=a((o^r)&t^r,n,t,e[11],22,10,-1990404162),r=a((t^o)&n^o,r,n,e[12],7,25,1804603682),o=a((n^t)&r^t,o,r,e[13],12,20,-40341101),t=a((r^n)&o^n,t,o,e[14],17,15,-1502002290),n=a((o^r)&t^r,n,t,e[15],22,10,1236535329),r=a((n^t)&o^t,r,n,e[1],5,27,-165796510),o=a((r^n)&t^n,o,r,e[6],9,23,-1069501632),t=a((o^r)&n^r,t,o,e[11],14,18,643717713),n=a((t^o)&r^o,n,t,e[0],20,12,-373897302),r=a((n^t)&o^t,r,n,e[5],5,27,-701558691),o=a((r^n)&t^n,o,r,e[10],9,23,38016083),t=a((o^r)&n^r,t,o,e[15],14,18,-660478335),n=a((t^o)&r^o,n,t,e[4],20,12,-405537848),r=a((n^t)&o^t,r,n,e[9],5,27,568446438),o=a((r^n)&t^n,o,r,e[14],9,23,-1019803690),t=a((o^r)&n^r,t,o,e[3],14,18,-187363961),n=a((t^o)&r^o,n,t,e[8],20,12,1163531501),r=a((n^t)&o^t,r,n,e[13],5,27,-1444681467),o=a((r^n)&t^n,o,r,e[2],9,23,-51403784),t=a((o^r)&n^r,t,o,e[7],14,18,1735328473),n=a((t^o)&r^o,n,t,e[12],20,12,-1926607734),i=n^t,r=a(i^o,r,n,e[5],4,28,-378558),o=a(i^r,o,r,e[8],11,21,-2022574463),f=o^r,t=a(f^n,t,o,e[11],16,16,1839030562),n=a(f^t,n,t,e[14],23,9,-35309556),i=n^t,r=a(i^o,r,n,e[1],4,28,-1530992060),o=a(i^r,o,r,e[4],11,21,1272893353),f=o^r,t=a(f^n,t,o,e[7],16,16,-155497632),n=a(f^t,n,t,e[10],23,9,-1094730640),i=n^t,r=a(i^o,r,n,e[13],4,28,681279174),o=a(i^r,o,r,e[0],11,21,-358537222),f=o^r,t=a(f^n,t,o,e[3],16,16,-722521979),n=a(f^t,n,t,e[6],23,9,76029189),i=n^t,r=a(i^o,r,n,e[9],4,28,-640364487),o=a(i^r,o,r,e[12],11,21,-421815835),f=o^r,t=a(f^n,t,o,e[15],16,16,530742520),n=a(f^t,n,t,e[2],23,9,-995338651),r=a(t^(n|~o),r,n,e[0],6,26,-198630844),o=a(n^(r|~t),o,r,e[7],10,22,1126891415),t=a(r^(o|~n),t,o,e[14],15,17,-1416354905),n=a(o^(t|~r),n,t,e[5],21,11,-57434055),r=a(t^(n|~o),r,n,e[12],6,26,1700485571),o=a(n^(r|~t),o,r,e[3],10,22,-1894986606),t=a(r^(o|~n),t,o,e[10],15,17,-1051523),n=a(o^(t|~r),n,t,e[1],21,11,-2054922799),r=a(t^(n|~o),r,n,e[8],6,26,1873313359),o=a(n^(r|~t),o,r,e[15],10,22,-30611744),t=a(r^(o|~n),t,o,e[6],15,17,-1560198380),n=a(o^(t|~r),n,t,e[13],21,11,1309151649),r=a(t^(n|~o),r,n,e[4],6,26,-145523070),o=a(n^(r|~t),o,r,e[11],10,22,-1120210379),t=a(r^(o|~n),t,o,e[2],15,17,718787259),n=a(o^(t|~r),n,t,e[9],21,11,-343485551),y[0]=r,y[1]=n,y[2]=t,y[3]=o}var u=[],d=[],A=[],h=[],l="0123456789abcdef".split(""),C=[],g=[],s=!1,v=0,w=0,y=[];if(r.Int32Array)d=new Int32Array(16),A=new Int32Array(16),h=new Int32Array(4),C=new Int32Array(4),g=new Int32Array(4),y=new Int32Array(4);else{var I;for(I=0;16>I;I++)d[I]=A[I]=0;for(I=0;4>I;I++)h[I]=C[I]=g[I]=y[I]=0}h[0]=128,h[1]=32768,h[2]=8388608,h[3]=-2147483648,C[0]=0,C[1]=8,C[2]=16,C[3]=24,r.md5=r.md5||e}("undefined"==typeof global?window:global);

</script>

</body>
</html>

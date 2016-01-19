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
    } else {
	console.log(receivable.type);
	console.log(receivable.content);
	document.body.appendChild(createTable(receivable.content));

//      if(firstAccess === 0) {
//        firstAccess = 1;
//        document.body.appendChild(createTable(receivable.content));
//      } else {
//        document.body.replaceChild(createTable(receivable.content), document.getElementById("myWordTable"));
//      }
    }
  }

</script>

<form>
  time: <input type="text" id="myTextField" value="" disabled>
</form>

<script language="javascript" type="text/javascript">

function createTable(tableData) {
    var table = document.createElement('table');
    var tableBody = document.createElement('tbody');
    table.id = "myWordTable";

    tableData.forEach(function(name) {
	console.log(name);
	var row = document.createElement('tr');
	var cell1 = document.createElement('td');
	cell1.appendChild(document.createTextNode(name));
	row.appendChild(cell1);

	var cell2 = document.createElement('td');
	var checkbox = document.createElement('input');
	checkbox.type = "checkbox";
	checkbox.name = "cb_"+name;
	checkbox.value = "0"
	cell2.appendChild(checkbox);

	row.appendChild(cell2);
	tableBody.appendChild(row);
    });

    table.appendChild(tableBody);

    return table;
}

</script>

</body>
</html>

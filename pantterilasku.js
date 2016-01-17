var pdfprinter = require("./pdfprinter");

var filename = "panthers.pdf";

var lasku = {
    "company"    : "CompanyName",
    "customer"   : "John Doe",
    "reference"  : "01234 12345 23456 34567 45678",
    "date"       : "15.01.2016",
    "number"     : "0123456",
    "id"         : "Y-12345",
    "intrest"    : "5%",
    "expireDate" : "22.01.2016",
    "notice"     : "14 days",
    "bankName"   : "Bank xxx",
    "iban"       : "FI00 1234 5678 9012 34",
    "bic"      : "xxxxFIHH"
}

var kamat = {
    "rivit" : [
	{ "tuote" : "Mömmöjä koko rahalla",
	  "n"     : "3",
	  "hinta" : "80.05",
	  "alv"   : "0.0" },
	{ "tuote" : "Kamaa ja Sälää",
	  "n"     : "1",
	  "hinta" : "11.40",
	  "alv"   : "22.0" },
	{ "tuote" : "Tilppeitä, krumeluureja ja pulju vasenkätisellä kierteellä",
	  "n"     : "7",
	  "hinta" : "19.90",
	  "alv"   : "16.5" },
	{ "tuote" : "farmikamaa, 1 tonnin erä",
	  "n"     : "1",
	  "hinta" : "33,07",
	  "alv"   : "32.0" },
	{ "tuote" : "De Ja Vu ranskalaisittain",
	  "n"     : "2",
	  "hinta" : "361.11",
	  "alv"   : "19.0" },
	{ "tuote" : "Nuppi Nuppi, Lipputangonnuppi",
	  "n"     : "1",
	  "hinta" : "3,90",
	  "alv"   : "22.0" }
    ]
}

pdfprinter.printSheet(filename, lasku, kamat);

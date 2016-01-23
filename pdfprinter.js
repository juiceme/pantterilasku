var PDFDocument = require("pdfkit");
var fs = require("fs");

var itemListStartYValue = 240;

function printTotalsBar(doc, yPosition, refNo, price, vat) {
    var y1 = yPosition * 12 + itemListStartYValue + 10;
    var cageHeight = 24;
    var y2 = y1 + cageHeight + 20;

    // Draw the middle cage
    doc.moveTo(142, y1 + 20).lineTo(560, y1 + 20).lineTo(560, (y1 + 21)).lineTo(142, (y1 + 21));
    doc.moveTo(142, y2).lineTo(560, y2).lineTo(560, (y2 + 1)).lineTo(142, (y2 + 1));
    doc.moveTo(142, y1 + 20).lineTo(142, y2).lineTo(143, y2).lineTo(143, y1 + 20);
    doc.moveTo(313, y1 + 20).lineTo(313, y2).lineTo(314, y2).lineTo(314, y1 + 20);
    doc.moveTo(513, y1 + 20).lineTo(513, y2).lineTo(514, y2).lineTo(514, y1 + 20);
    doc.moveTo(559, y1 + 20).lineTo(559, y2).lineTo(560, y2).lineTo(560, y1 + 20);

    doc.fontSize(7).font('Times-Roman')
	.text("Viitenumero", 150, (y1 + 24));
    doc.fontSize(10).font('Times-Roman').
	text(refNo, 155, (y1 + 32));
    doc.fontSize(8).font('Times-Roman')
	.text("Arvonlisäveroton hinta yhteensä", 401, y1)
	.text(price.toFixed(2), 530, y1);
    doc.fontSize(8).font('Times-Roman')
	.text("Arvonlisävero yhteensä", 430, (y1 + 10)).
	text(vat.toFixed(2), 530, (y1 + 10));
    doc.fontSize(8).font('Times-Bold')
	.text("Lasku yhteensä euroa", 431, (y1 + 32))
	.text((vat+price).toFixed(2), 530, (y1 + 32));
}

function printHeader(doc, bill) {
    // Fixed textfields
    doc.fontSize(11).font('Times-Bold')
	.text("LASKU", 370, 36);
    doc.fontSize(7).font('Times-Roman')
	.text("Laskun päivämäärä", 370, 63)
	.text("Laskun numero", 370, 112)
	.text("Asiakkaan Y-tunnus", 370, 137)
	.text("Eräpäivä", 470, 137)
	.text("Viivästyskorko", 370, 161)
	.text("Huomautusaika", 470, 161)
	.text("Selite", 60, 222)
	.text("Määrä", 338, 222)
	.text("Yksikkö", 368, 222)
	.text("a-hinta", 410, 222)
	.text("Alv. %", 488, 222)
	.text("Yhteensä", 525, 222);

    // Variable textfields
    doc.fontSize(11).font('Times-Bold')
	.text(bill.company, 60, 36);
    doc.fontSize(11).font('Times-Roman')
	.text(bill.customer, 64, 120);
    doc.fontSize(8).font('Times-Roman')
	.text(bill.date, 372, 71)
	.text(bill.number, 372, 120)
	.text(bill.id, 372, 147)
	.text(bill.intrest, 372, 171)
	.text(bill.expireDate, 472, 147)
	.text(bill.notice, 472, 171);
}

function printItemList(doc, itemList) {
    var yposition = itemListStartYValue;
    // loop thru the product array
    itemList.forEach( function(s) {
	var price = parseInt(s.n) * parseFloat(s.price);
	var vatPrice = price + price * parseFloat(s.vat) / 100;
	doc.fontSize(8)
	    .text(s.description, 65, yposition)
	    .text(s.n, 344, yposition)
	    .text("kpl", 373, yposition)
	    .text(s.price, 415, yposition)
	    .text(s.vat, 493, yposition)
	    .text(vatPrice.toFixed(2), 530, yposition);
	yposition = yposition + 12;
    });
}

function printFooter(doc, bill, total) {
    // Draw the bottom cage, 3 top lines
    doc.moveTo(23, 570).lineTo(585, 570).lineTo(585, 571).lineTo(23, 571).fill("#000000")
    doc.moveTo(23, 613).lineTo(585, 613).lineTo(585, 614).lineTo(23, 614).fill("#000000")
    doc.moveTo(23, 650).lineTo(315, 650).lineTo(315, 651).lineTo(23, 651).fill("#000000")
    // Draw the bottom cage, 5 vertical lines
    doc.moveTo(75, 570).lineTo(75, 650).lineTo(76, 650).lineTo(76, 570).fill("#000000")
    doc.moveTo(314, 570).lineTo(314, 770).lineTo(315, 770).lineTo(315, 570).fill("#000000")
    doc.moveTo(75, 746).lineTo(75, 770).lineTo(76, 770).lineTo(76, 746).fill("#000000")
    doc.moveTo(354, 722).lineTo(354, 770).lineTo(355, 770).lineTo(355, 722).fill("#000000")
    doc.moveTo(446, 746).lineTo(446, 770).lineTo(447, 770).lineTo(447, 746).fill("#000000")
    // Draw the bottom cage, 4 bottom lines
    doc.moveTo(314, 722).lineTo(585, 722).lineTo(585, 723).lineTo(315, 723).fill("#000000")
    doc.moveTo(23, 746).lineTo(585, 746).lineTo(585, 747).lineTo(23, 747).fill("#000000")
    doc.moveTo(23, 770).lineTo(585, 770).lineTo(585, 771).lineTo(23, 771).fill("#000000")
    doc.moveTo(75, 737).lineTo(314, 737).lineTo(314, 738).lineTo(75, 738).fill("#000000")

    // Fixed textfields
    doc.fontSize(7).font('Times-Roman')
	.text("Pankki", 445, 522)
	.text("Saajan", 52, 578).text("Tilinumero", 40, 586)
	.text("IBAN", 81, 581)
	.text("BIC", 320, 581)
	.text("Saaja", 56, 621)
	.text("Maksajan", 45, 657).text("nimi ja", 53, 665).text("osoite", 55, 673)
	.text("Allekirjoitus", 36, 730)
	.text("Tililtä nro",  44, 752)
	.text("Viitenumero", 317, 729).text("Eräpäivä", 317, 752)
	.text("Euro", 450, 752)
    doc.fontSize(6).font('Times-Roman')
	.text("Maksu välitetään saajalle maksujenvälityksen ehtojen", 434, 779)
	.text("mukaisesti ja vain maksajan ilmoittaman tilinumeron", 434, 785)
	.text("perusteella", 434, 791);

    // Variable textfields
    doc.fontSize(7).font('Times-Roman')
	.text(bill.company, 57, 522)
	.text(bill.bankName, 445, 530)
	.text(("IBAN " + bill.iban), 445, 538)
	.text(("BIC " + bill.bic), 445, 546);

    doc.fontSize(10).font('Times-Roman')
	.text((bill.bankName + "    " + bill.iban), 84, 592)
	.text(bill.bic, 323, 592)
	.text(bill.company, 84, 623)
	.text(bill.customer, 84, 656)
	.text(bill.reference, 360, 732)
	.text(bill.expireDate, 360, 756)
	.text(total.toFixed(2), 540, 756);

    doc.rotate(-90, {origin: [26, 715]}).fontSize(7).font('Times-Bold')
	doc.text("TILISIIRTO", 26, 715);
}

function printSheet(filename, billData, itemList) {
    // Create the document
    var doc = new PDFDocument({	size: "a4",
				layout: "portrait",
				margins: { top: 0, left: 0, bottom: 0, right: 0 } });

    // Pipe it's output somewhere, like to a file or HTTP response
    // See below for browser usage
    doc.pipe(fs.createWriteStream(filename));

    // Draw the header part of the bill
    printHeader(doc, billData);

    // Draw the horizontal divider line
    doc.save().moveTo(55, 208).lineTo(560, 208).lineTo(560, 209).lineTo(55, 209).fill("#000000")

    // Itemized list of products
    printItemList(doc, itemList);

    // Draw the totals bar
    var totalNoVat = itemList.map(function(s){return(parseInt(s.n)*parseFloat(s.price))})
	.reduce(function(a, b){return a + b;});
    var totalVat = itemList.map(function(s){return(parseInt(s.n)*parseFloat(s.price)*parseFloat(s.vat)/100)})
	.reduce(function(a, b){return a + b;});
    printTotalsBar(doc, itemList.length, billData.reference, totalNoVat, totalVat);

    // Draw the footer
    printFooter(doc, billData, (totalNoVat + totalVat));

    // Finalize PDF file
    doc.end()
}

exports.printSheet = printSheet;

# pantterilasku

A node.js invoice/bill creation utility handy for generating and emailing PDF-formatted invoices to multiple recipients.

## Description

Pantterilasku automates creating invoices/bills for multiple recipients. There is a PDF template that is filled automatically by recipient data and itemized list of billable products/services and mailed to the recipients.

Input data for the recipients and items are stored as JSON files. Web-interface enables adding items separately for each recipient.

## Installation

Pantterilasku requires websocket, pdfkit, emailjs and md5 npm modules. You can install all depencencies by "npm install"
The repository clones AES library as submodule, You need to install it by "git submodule init; git submodule update"

## Features

* PDF templating
* Recipients managed in JSON file
* Item list managed in JSON file
* Web frontend to manage, generate and batch-email invoices/bills
* Uses AES-CTR encryption between server and client to defeat man-in-the-middle attacks.
* Preview for generated PDF invoices in the browser
* Automatic batch mailing of invoices
  
## Coming soon!

* Probably more enhancements as I think them up :)
    
## Documentation

None whatsoever :)

## License

Pantterilasku is available under the GPLv3 license.
